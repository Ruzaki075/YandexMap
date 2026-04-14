package handlers

import (
	"encoding/json"
	"io"
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
	repo := repositories.NewMarkerRepository()
	markers, err := repo.GetAll()
	if err != nil {
		respondWithError(w, 500, "Database error")
		return
	}
	respondWithJSON(w, 200, map[string]interface{}{
		"markers": markers,
		"count":   len(markers),
	})
}

func CreateMarkerHandler(w http.ResponseWriter, r *http.Request) {
	var req models.CreateMarkerRequest
	json.NewDecoder(r.Body).Decode(&req)

	repo := repositories.NewMarkerRepository()

	if !repo.UserExists(req.UserID) {
		respondWithError(w, 400, "User not found")
		return
	}

	id, err := repo.Create(req)
	if err != nil {
		respondWithError(w, 500, "Database error")
		return
	}

	email, _ := repo.GetUserEmail(req.UserID)

	respondWithJSON(w, 201, map[string]interface{}{
		"status": "success",
		"marker": map[string]interface{}{
			"id":              id,
			"user_id":         req.UserID,
			"user_email":      email,
			"text":            req.Text,
			"domain_key":      req.DomainKey,
			"group_key":       req.GroupKey,
			"issue_key":       req.IssueKey,
			"ai_confidence":   req.AIConfidence,
		},
	})
}

func DeleteMarkerHandler(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.Atoi(mux.Vars(r)["id"])
	repo := repositories.NewMarkerRepository()
	repo.Delete(id)

	respondWithJSON(w, 200, map[string]string{
		"status":  "success",
		"message": "Marker deleted",
	})
}

// UpdateMarkerStatusHandler — смена статуса метки (модерация). Только is_moderator в JWT.
func UpdateMarkerStatusHandler(w http.ResponseWriter, r *http.Request) {
	if !middleware.GetIsModeratorFromContext(r.Context()) {
		respondWithError(w, http.StatusForbidden, "Moderator only")
		return
	}
	id, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil || id <= 0 {
		respondWithError(w, http.StatusBadRequest, "Invalid marker id")
		return
	}
	var body struct {
		Status string `json:"status"`
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
	repo := repositories.NewMarkerRepository()
	if err := repo.UpdateStatus(id, status); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}
	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"status":        "success",
		"id":            id,
		"marker_status": status,
	})
}

func UploadImageHandler(w http.ResponseWriter, r *http.Request) {
	r.ParseMultipartForm(10 << 20)

	file, handler, _ := r.FormFile("image")
	defer file.Close()

	os.MkdirAll("uploads", 0755)
	name := strconv.FormatInt(time.Now().UnixNano(), 10) + "_" + handler.Filename
	path := filepath.Join("uploads", name)

	dst, _ := os.Create(path)
	defer dst.Close()
	io.Copy(dst, file)

	respondWithJSON(w, 200, map[string]interface{}{
		"status":    "success",
		"image_url": "/uploads/" + name,
	})
}
