package handlers

import (
	"database/sql"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"backend/database"
	"backend/middleware"
	"backend/models"
	"backend/repositories"
	"backend/utils"
	"github.com/gorilla/mux"
)

func GetMarkersHandler(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	page, _ := strconv.Atoi(q.Get("page"))
	pageSize, _ := strconv.Atoi(q.Get("page_size"))
	domainKey := strings.TrimSpace(q.Get("domain_key"))
	status := strings.TrimSpace(q.Get("status"))
	overdueOnly := q.Get("overdue") == "1" || strings.EqualFold(q.Get("overdue"), "true")

	repo := repositories.NewMarkerRepository()

	if page > 0 && pageSize > 0 {
		if pageSize > 100 {
			pageSize = 100
		}
		markers, total, err := repo.ListFiltered(domainKey, status, overdueOnly, page, pageSize)
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

	layer := strings.TrimSpace(q.Get("layer"))
	swLat, _ := strconv.ParseFloat(q.Get("sw_lat"), 64)
	swLng, _ := strconv.ParseFloat(q.Get("sw_lng"), 64)
	neLat, _ := strconv.ParseFloat(q.Get("ne_lat"), 64)
	neLng, _ := strconv.ParseFloat(q.Get("ne_lng"), 64)
	var markers []models.Marker
	var err error
	if swLat != 0 || swLng != 0 || neLat != 0 || neLng != 0 {
		markers, err = repo.GetPublicMarkersInBounds(swLat, swLng, neLat, neLng, layer)
	} else {
		markers, err = repo.GetPublicMarkers(layer)
	}
	if err != nil {
		log.Printf("GetMarkersHandler: %v", err)
		respondWithError(w, 500, "Database error")
		return
	}
	respondWithJSON(w, 200, map[string]interface{}{
		"markers": markers,
		"count":   len(markers),
		"layer":   layer,
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

	if utils.ContainsProfanity(req.Text) {
		respondWithError(w, http.StatusBadRequest, "Текст содержит недопустимые выражения. Переформулируйте описание.")
		return
	}

	if req.ImageLatitude != nil && req.ImageLongitude != nil {
		dist := utils.HaversineMeters(req.Latitude, req.Longitude, *req.ImageLatitude, *req.ImageLongitude)
		if dist > 500 {
			respondWithError(w, http.StatusBadRequest,
				"Координаты на фото сильно отличаются от точки на карте. Укажите место на карте ближе к снимку.")
			return
		}
	}

	if !req.ForceCreate {
		nearby, errN := repositories.NewSupportRepository().FindNearby(req.Latitude, req.Longitude, 100, 5)
		if errN == nil && len(nearby) > 0 {
			respondWithJSON(w, http.StatusConflict, map[string]interface{}{
				"error":           "nearby_exists",
				"message":         "Рядом уже есть похожие обращения. Поддержите существующее вместо новой метки.",
				"nearby_markers":  nearby,
			})
			return
		}
	}

	id, err := repo.Create(req)
	if err != nil {
		respondWithError(w, 500, "Database error")
		return
	}

	email, _ := repo.GetUserEmail(req.UserID)

	snip := truncSnippet(req.Text, 200)
	mid := id
	nrepo := repositories.NewNotificationRepository()
	if _, errN := nrepo.Create(uid, "marker_submitted", &mid, "Обращение отправлено",
		"Ваша заявка принята и ожидает проверки модератором.\n\n«"+snip+"»"); errN != nil {
		log.Printf("notification create (submitted): %v", errN)
	}

	go repositories.NotifyGeoSubscribers(req.Latitude, req.Longitude, id, uid, "new")
	database.SyncMarkerLocation(id, req.Latitude, req.Longitude)

	markerPayload, _ := repo.GetByID(id)
	if markerPayload != nil {
		broadcastMarkerCreated(markerPayload)
	}

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
	actor := uid
	mid := id
	repositories.InsertAuditLog(&actor, "marker_delete", "marker", &mid, map[string]interface{}{})
	broadcastMarkerUpdated(id, map[string]interface{}{"deleted": true})

	respondWithJSON(w, 200, map[string]string{
		"status":  "success",
		"message": "Marker deleted",
	})
}

// PatchMarkerHandler — правка текста своего обращения в статусе pending.
func PatchMarkerHandler(w http.ResponseWriter, r *http.Request) {
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
	var body struct {
		Text          string `json:"text"`
		ImageAfterURL string `json:"image_after_url"`
		AddressText   string `json:"address_text"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid JSON")
		return
	}
	repo := repositories.NewMarkerRepository()
	if body.ImageAfterURL != "" || body.AddressText != "" {
		if err := repo.UpdateMarkerMeta(id, uid, body.ImageAfterURL, body.AddressText); err != nil {
			if err == sql.ErrNoRows {
				respondWithError(w, http.StatusForbidden, "Forbidden")
				return
			}
		}
		actor := uid
		if body.ImageAfterURL != "" {
			_ = repositories.InsertMarkerChange(id, "image_after_url", "", body.ImageAfterURL, &actor)
		}
		if body.AddressText != "" {
			_ = repositories.InsertMarkerChange(id, "address_text", "", body.AddressText, &actor)
		}
		broadcastMarkerUpdated(id, map[string]interface{}{
			"image_after_url": body.ImageAfterURL,
			"address_text":    body.AddressText,
		})
	}
	text := strings.TrimSpace(body.Text)
	if text == "" {
		if body.ImageAfterURL != "" || body.AddressText != "" {
			respondWithJSON(w, http.StatusOK, map[string]interface{}{"status": "success", "id": id})
			return
		}
		respondWithError(w, http.StatusBadRequest, "Text is required")
		return
	}
	if utils.ContainsProfanity(text) {
		respondWithError(w, http.StatusBadRequest, "Текст содержит недопустимые выражения")
		return
	}
	if err := repo.UpdateText(id, uid, text); err != nil {
		if err == sql.ErrNoRows {
			respondWithError(w, http.StatusForbidden, "Можно редактировать только своё обращение на проверке")
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}
	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"status": "success",
		"id":     id,
	})
}

// applyMarkerStatusUpdate — одна смена статуса: БД + журнал + уведомления владельцу + карма.
func applyMarkerStatusUpdate(id int, status string, notePtr *string, actorUserID int) error {
	repo := repositories.NewMarkerRepository()
	ownerID, oldStatus, snippet, metaErr := repo.GetMarkerNotifyMeta(id)
	if metaErr != nil {
		return metaErr
	}
	if err := repo.UpdateStatus(id, status, notePtr); err != nil {
		return err
	}
	var actorPtr *int
	if actorUserID > 0 {
		actorPtr = &actorUserID
	}
	_ = repositories.InsertMarkerStatusLog(id, oldStatus, status, actorPtr, notePtr)
	_ = repositories.InsertMarkerChange(id, "status", oldStatus, status, actorPtr)
	tid := id
	repositories.InsertAuditLog(actorPtr, "marker_status_change", "marker", &tid, map[string]interface{}{
		"old": oldStatus, "new": status,
	})
	broadcastMarkerUpdated(id, map[string]interface{}{"status": status})
	if ownerID > 0 {
		nrepo := repositories.NewNotificationRepository()
		mid := id
		snip := truncSnippet(snippet, 200)
		switch status {
		case "approved":
			if _, errN := nrepo.Create(ownerID, "marker_approved", &mid, "Обращение принято",
				"Модератор одобрил вашу метку — она видна на карте.\n\n«"+snip+"»"); errN != nil {
				log.Printf("notification create (approved): %v", errN)
			}
			repositories.AddKarma(ownerID, 5)
		case "in_progress":
			if _, errN := nrepo.Create(ownerID, "marker_in_progress", &mid, "Обращение в работе",
				"По вашему обращению начаты работы.\n\n«"+snip+"»"); errN != nil {
				log.Printf("notification create (in_progress): %v", errN)
			}
		case "rejected":
			b := "Модератор отклонил заявку.\n\n«" + snip + "»"
			if notePtr != nil && *notePtr != "" {
				b += "\n\nКомментарий модератора: " + *notePtr
			}
			if _, errN := nrepo.Create(ownerID, "marker_rejected", &mid, "Обращение отклонено", b); errN != nil {
				log.Printf("notification create (rejected): %v", errN)
			}
		case "resolved":
			if _, errN := nrepo.Create(ownerID, "marker_resolved", &mid, "Проблема решена",
				"Модератор отметил обращение как решённое.\n\n«"+snip+"»"); errN != nil {
				log.Printf("notification create (resolved): %v", errN)
			}
			repositories.AddKarma(ownerID, 10)
			var lat, lng float64
			if err := database.DB.QueryRow(
				`SELECT latitude, longitude FROM markers WHERE id = $1`, id,
			).Scan(&lat, &lng); err == nil {
				go repositories.NotifyGeoSubscribers(lat, lng, id, ownerID, "resolved")
			}
		}
	}
	return nil
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
		Status        string  `json:"status"`
		ModeratorNote *string `json:"moderator_note"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid JSON")
		return
	}
	status := strings.ToLower(strings.TrimSpace(body.Status))
	allowed := map[string]bool{
		"pending": true, "approved": true, "rejected": true, "resolved": true, "in_progress": true,
	}
	if !allowed[status] {
		respondWithError(w, http.StatusBadRequest, "Invalid status: use pending, approved, in_progress, rejected, resolved")
		return
	}
	var notePtr *string
	if body.ModeratorNote != nil {
		t := strings.TrimSpace(*body.ModeratorNote)
		if t != "" {
			notePtr = &t
		}
	}
	if status == "rejected" && notePtr == nil {
		respondWithError(w, http.StatusBadRequest, "При отклонении укажите причину (moderator_note)")
		return
	}
	actorID, _ := middleware.GetUserIDFromContext(r.Context())
	if err := applyMarkerStatusUpdate(id, status, notePtr, actorID); err != nil {
		if err == sql.ErrNoRows {
			respondWithError(w, http.StatusNotFound, "Marker not found")
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}
	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"status":        "success",
		"id":            id,
		"marker_status": status,
	})
}

// BulkUpdateMarkerStatusHandler — массовая смена статуса (модератор/админ). До 100 id за запрос.
func BulkUpdateMarkerStatusHandler(w http.ResponseWriter, r *http.Request) {
	if !middleware.GetIsModeratorFromContext(r.Context()) && !middleware.GetIsAdminFromContext(r.Context()) {
		respondWithError(w, http.StatusForbidden, "Moderator or admin only")
		return
	}
	var body struct {
		IDs           []int   `json:"ids"`
		Status        string  `json:"status"`
		ModeratorNote *string `json:"moderator_note"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid JSON")
		return
	}
	status := strings.ToLower(strings.TrimSpace(body.Status))
	allowed := map[string]bool{
		"pending": true, "approved": true, "rejected": true, "resolved": true, "in_progress": true,
	}
	if !allowed[status] {
		respondWithError(w, http.StatusBadRequest, "Invalid status")
		return
	}
	var notePtr *string
	if body.ModeratorNote != nil {
		t := strings.TrimSpace(*body.ModeratorNote)
		if t != "" {
			notePtr = &t
		}
	}
	seen := map[int]bool{}
	var ids []int
	for _, id := range body.IDs {
		if id <= 0 || seen[id] {
			continue
		}
		seen[id] = true
		ids = append(ids, id)
		if len(ids) >= 100 {
			break
		}
	}
	if len(ids) == 0 {
		respondWithError(w, http.StatusBadRequest, "No valid ids")
		return
	}
	if status == "rejected" && notePtr == nil {
		respondWithError(w, http.StatusBadRequest, "При массовом отклонении укажите причину (moderator_note)")
		return
	}
	actorID, _ := middleware.GetUserIDFromContext(r.Context())
	var ok []int
	var failed []map[string]interface{}
	for _, id := range ids {
		if err := applyMarkerStatusUpdate(id, status, notePtr, actorID); err != nil {
			failed = append(failed, map[string]interface{}{"id": id, "error": err.Error()})
		} else {
			ok = append(ok, id)
		}
	}
	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"status":           "success",
		"updated_ids":      ok,
		"updated_count":     len(ok),
		"failed":            failed,
		"marker_status":     status,
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
