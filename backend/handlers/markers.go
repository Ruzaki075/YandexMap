package handlers

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"backend/middleware"
	"backend/models"
	"backend/repositories"
	"github.com/gorilla/mux"
)

func GetMarkersHandler(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	page, _ := strconv.Atoi(q.Get("page"))
	pageSize, _ := strconv.Atoi(q.Get("page_size"))
	domainKey := strings.TrimSpace(q.Get("domain_key"))
	status := strings.TrimSpace(q.Get("status"))

	repo := repositories.NewMarkerRepository()

	if page > 0 && pageSize > 0 {
		if pageSize > 100 {
			pageSize = 100
		}
		markers, total, err := repo.ListFiltered(domainKey, status, page, pageSize)
		if err != nil {
			respondWithError(w, 500, "Database error")
			return
		}
		respondWithJSON(w, 200, map[string]interface{}{
			"markers":    markers,
			"total":      total,
			"page":       page,
			"page_size":  pageSize,
			"count":      len(markers),
		})
		return
	}

	markers, err := repo.GetPublicMarkers()
	if err != nil {
		respondWithError(w, 500, "Database error")
		return
	}
	respondWithJSON(w, 200, map[string]interface{}{
		"markers": markers,
		"count":   len(markers),
	})
}

func GetMyMarkersHandler(w http.ResponseWriter, r *http.Request) {
	uid, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	repo := repositories.NewMarkerRepository()
	markers, err := repo.ListByUserID(uid)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}
	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"markers": markers,
		"count":   len(markers),
	})
}

// CreateMarkerHandler требует JWT: метка создаётся от имени владельца токена (user_id из тела игнорируется).
func CreateMarkerHandler(w http.ResponseWriter, r *http.Request) {
	uid, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req models.CreateMarkerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid JSON")
		return
	}

	repo := repositories.NewMarkerRepository()
	if !repo.UserExists(uid) {
		respondWithError(w, 400, "User not found")
		return
	}

	req.UserID = uid

	id, err := repo.Create(req)
	if err != nil {
		respondWithError(w, 500, "Database error")
		return
	}

	email, _ := repo.GetUserEmail(req.UserID)

	respondWithJSON(w, 201, map[string]interface{}{
		"status": "success",
		"marker": map[string]interface{}{
			"id":            id,
			"user_id":       req.UserID,
			"user_email":    email,
			"text":          req.Text,
			"domain_key":    req.DomainKey,
			"group_key":     req.GroupKey,
			"issue_key":     req.IssueKey,
			"ai_confidence": req.AIConfidence,
		},
	})
}

func DeleteMarkerHandler(w http.ResponseWriter, r *http.Request) {
	uid, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	id, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil || id <= 0 {
		respondWithError(w, http.StatusBadRequest, "Invalid marker id")
		return
	}
	repo := repositories.NewMarkerRepository()
	ownerID, err := repo.GetMarkerOwnerUserID(id)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "Marker not found")
		return
	}
	isMod := middleware.GetIsModeratorFromContext(r.Context())
	isAdm := middleware.GetIsAdminFromContext(r.Context())
	if ownerID != uid && !isMod && !isAdm {
		respondWithError(w, http.StatusForbidden, "Forbidden")
		return
	}
	if err := repo.Delete(id); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}

	respondWithJSON(w, 200, map[string]string{
		"status":  "success",
		"message": "Marker deleted",
	})
}

// UpdateMarkerStatusHandler — смена статуса метки (модерация). Модератор или администратор.
func UpdateMarkerStatusHandler(w http.ResponseWriter, r *http.Request) {
	if !middleware.GetIsModeratorFromContext(r.Context()) && !middleware.GetIsAdminFromContext(r.Context()) {
		respondWithError(w, http.StatusForbidden, "Moderator or admin only")
		return
	}
	id, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil || id <= 0 {
		respondWithError(w, http.StatusBadRequest, "Invalid marker id")
		return
	}
	var body struct {
		Status         string  `json:"status"`
		ModeratorNote  *string `json:"moderator_note"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid JSON")
		return
	}
	status := strings.ToLower(strings.TrimSpace(body.Status))
	allowed := map[string]bool{
		"pending": true, "approved": true, "rejected": true, "resolved": true,
	}
	if !allowed[status] {
		respondWithError(w, http.StatusBadRequest, "Invalid status: use pending, approved, rejected, resolved")
		return
	}
	var notePtr *string
	if body.ModeratorNote != nil {
		t := strings.TrimSpace(*body.ModeratorNote)
		if t != "" {
			notePtr = &t
		}
	}
	repo := repositories.NewMarkerRepository()
	ownerID, _, snippet, metaErr := repo.GetMarkerNotifyMeta(id)
	if metaErr != nil {
		respondWithError(w, http.StatusNotFound, "Marker not found")
		return
	}
	if err := repo.UpdateStatus(id, status, notePtr); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}
	if (status == "approved" || status == "rejected") && ownerID > 0 {
		nrepo := repositories.NewNotificationRepository()
		mid := id
		snip := truncSnippet(snippet, 200)
		if status == "approved" {
			if _, errN := nrepo.Create(ownerID, "marker_approved", &mid, "Обращение принято",
				"Модератор одобрил вашу метку — она видна на карте.\n\n«"+snip+"»"); errN != nil {
				log.Printf("notification create (approved): %v", errN)
			}
		} else {
			b := "Модератор отклонил заявку.\n\n«" + snip + "»"
			if notePtr != nil && *notePtr != "" {
				b += "\n\nКомментарий модератора: " + *notePtr
			}
			if _, errN := nrepo.Create(ownerID, "marker_rejected", &mid, "Обращение отклонено", b); errN != nil {
				log.Printf("notification create (rejected): %v", errN)
			}
		}
	}
	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"status":        "success",
		"id":            id,
		"marker_status": status,
	})
}

func UploadImageHandler(w http.ResponseWriter, r *http.Request) {
	if _, ok := middleware.GetUserIDFromContext(r.Context()); !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	r.ParseMultipartForm(10 << 20)

	file, handler, err := r.FormFile("image")
	if err != nil || handler == nil {
		respondWithError(w, http.StatusBadRequest, "image field required")
		return
	}
	defer file.Close()

	os.MkdirAll("uploads", 0755)
	name := strconv.FormatInt(time.Now().UnixNano(), 10) + "_" + handler.Filename
	path := filepath.Join("uploads", name)

	dst, err := os.Create(path)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Cannot save file")
		return
	}
	defer dst.Close()
	if _, err := io.Copy(dst, file); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Cannot write file")
		return
	}

	respondWithJSON(w, 200, map[string]interface{}{
		"status":    "success",
		"image_url": "/uploads/" + name,
	})
}

func truncSnippet(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n]) + "…"
}
