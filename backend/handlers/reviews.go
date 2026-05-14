package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"backend/middleware"
	"backend/models"
	"backend/repositories"
	"github.com/gorilla/mux"
)

func ReviewSummaryHandler(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil || id <= 0 {
		respondWithError(w, http.StatusBadRequest, "Invalid marker id")
		return
	}
	repo := repositories.NewReviewRepository()
	count, avg, err := repo.Summary(id)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}
	out := map[string]interface{}{
		"marker_id": id,
		"count":     count,
	}
	if avg != nil {
		out["avg"] = *avg
	} else {
		out["avg"] = nil
	}
	respondWithJSON(w, http.StatusOK, out)
}

func ListReviewsHandler(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil || id <= 0 {
		respondWithError(w, http.StatusBadRequest, "Invalid marker id")
		return
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	repo := repositories.NewReviewRepository()
	list, total, err := repo.List(id, limit, offset)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}
	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"reviews": list,
		"total":   total,
	})
}

func GetMyReviewHandler(w http.ResponseWriter, r *http.Request) {
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
	repo := repositories.NewReviewRepository()
	rev, err := repo.GetUserReview(id, uid)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}
	if rev == nil {
		respondWithJSON(w, http.StatusOK, map[string]interface{}{"review": nil})
		return
	}
	respondWithJSON(w, http.StatusOK, map[string]interface{}{"review": rev})
}

func UpsertReviewHandler(w http.ResponseWriter, r *http.Request) {
	uid, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	markerID, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil || markerID <= 0 {
		respondWithError(w, http.StatusBadRequest, "Invalid marker id")
		return
	}
	mrepo := repositories.NewMarkerRepository()
	owner, err := mrepo.GetMarkerOwnerUserID(markerID)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "Marker not found")
		return
	}
	if owner == uid {
		respondWithError(w, http.StatusBadRequest, "Нельзя оценивать собственное обращение")
		return
	}

	var req models.UpsertReviewRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid JSON")
		return
	}
	if req.Rating < 1 || req.Rating > 5 {
		respondWithError(w, http.StatusBadRequest, "rating must be 1..5")
		return
	}
	comment := strings.TrimSpace(req.Comment)
	if len(comment) > 2000 {
		respondWithError(w, http.StatusBadRequest, "comment too long")
		return
	}

	rrepo := repositories.NewReviewRepository()
	rid, err := rrepo.Upsert(markerID, uid, req.Rating, comment)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}
	count, avg, _ := rrepo.Summary(markerID)
	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"status":       "success",
		"id":           rid,
		"review_count": count,
		"review_avg":   avg,
	})
}

func ModerationStatsHandler(w http.ResponseWriter, r *http.Request) {
	if !middleware.GetIsModeratorFromContext(r.Context()) && !middleware.GetIsAdminFromContext(r.Context()) {
		respondWithError(w, http.StatusForbidden, "Moderator or admin only")
		return
	}
	repo := repositories.NewMarkerRepository()
	dash, err := repo.ModerationDashboard()
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}
	raw, _ := json.Marshal(dash)
	var payload map[string]interface{}
	_ = json.Unmarshal(raw, &payload)
	payload["status"] = "success"
	respondWithJSON(w, http.StatusOK, payload)
}
