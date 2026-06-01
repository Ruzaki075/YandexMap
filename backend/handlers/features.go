package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"

	"backend/database"
	"backend/middleware"
	"backend/realtime"
	"backend/repositories"
	"github.com/gorilla/mux"
)

func SearchMarkersHandler(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	list, err := repositories.SearchMarkers(q, limit)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Search error")
		return
	}
	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"markers": list,
		"count":   len(list),
		"q":       q,
	})
}

func MarkerTimelineHandler(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil || id <= 0 {
		respondWithError(w, http.StatusBadRequest, "Invalid marker id")
		return
	}
	list, err := repositories.ListMarkerTimeline(id, 100)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}
	respondWithJSON(w, http.StatusOK, map[string]interface{}{"timeline": list})
}

func PublicUserProfileHandler(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil || id <= 0 {
		respondWithError(w, http.StatusBadRequest, "Invalid user id")
		return
	}
	prof, err := repositories.PublicUserProfile(id)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "User not found")
		return
	}
	respondWithJSON(w, http.StatusOK, prof)
}

func UserActivityCalendarHandler(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil || id <= 0 {
		respondWithError(w, http.StatusBadRequest, "Invalid user id")
		return
	}
	year, _ := strconv.Atoi(r.URL.Query().Get("year"))
	cal, err := repositories.UserActivityCalendar(id, year)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}
	respondWithJSON(w, http.StatusOK, map[string]interface{}{"calendar": cal, "year": year})
}

func ListFavoritesHandler(w http.ResponseWriter, r *http.Request) {
	uid, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	list, err := repositories.ListFavorites(uid, 50)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}
	respondWithJSON(w, http.StatusOK, map[string]interface{}{"favorites": list})
}

func AddFavoriteHandler(w http.ResponseWriter, r *http.Request) {
	uid, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	var body struct {
		MarkerID int `json:"marker_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.MarkerID <= 0 {
		respondWithError(w, http.StatusBadRequest, "marker_id required")
		return
	}
	if err := repositories.AddFavorite(uid, body.MarkerID); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}
	respondWithJSON(w, http.StatusOK, map[string]interface{}{"status": "success"})
}

func RemoveFavoriteHandler(w http.ResponseWriter, r *http.Request) {
	uid, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	mid, err := strconv.Atoi(mux.Vars(r)["markerId"])
	if err != nil || mid <= 0 {
		respondWithError(w, http.StatusBadRequest, "Invalid marker id")
		return
	}
	_ = repositories.RemoveFavorite(uid, mid)
	respondWithJSON(w, http.StatusOK, map[string]interface{}{"status": "success"})
}

func FavoriteStatusHandler(w http.ResponseWriter, r *http.Request) {
	uid, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	mid, err := strconv.Atoi(mux.Vars(r)["markerId"])
	if err != nil || mid <= 0 {
		respondWithError(w, http.StatusBadRequest, "Invalid marker id")
		return
	}
	on, _ := repositories.IsFavorite(uid, mid)
	respondWithJSON(w, http.StatusOK, map[string]interface{}{"favorited": on})
}

func AnalyticsDashboardHandler(w http.ResponseWriter, r *http.Request) {
	days, _ := strconv.Atoi(r.URL.Query().Get("days"))
	d, err := repositories.GetAnalyticsDashboard(days)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}
	respondWithJSON(w, http.StatusOK, d)
}

func LeaderboardSeasonHandler(w http.ResponseWriter, r *http.Request) {
	period := strings.TrimSpace(r.URL.Query().Get("period"))
	if period == "" {
		period = "month"
	}
	list, err := repositories.LeaderboardByPeriod(period, 20)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}
	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"leaders": list,
		"period":  period,
	})
}

func AdminAuditLogHandler(w http.ResponseWriter, r *http.Request) {
	if !middleware.GetIsAdminFromContext(r.Context()) {
		respondWithError(w, http.StatusForbidden, "Admin only")
		return
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	list, err := repositories.ListAuditLog(limit, offset)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}
	respondWithJSON(w, http.StatusOK, map[string]interface{}{"entries": list})
}

func PostAbuseReportHandler(w http.ResponseWriter, r *http.Request) {
	uid, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	var body struct {
		TargetType string `json:"target_type"`
		TargetID   int    `json:"target_id"`
		Reason     string `json:"reason"`
		Details    string `json:"details"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid JSON")
		return
	}
	body.TargetType = strings.TrimSpace(body.TargetType)
	body.Reason = strings.TrimSpace(body.Reason)
	if body.TargetID <= 0 || body.TargetType == "" || body.Reason == "" {
		respondWithError(w, http.StatusBadRequest, "target_type, target_id, reason required")
		return
	}
	id, err := repositories.CreateAbuseReport(uid, body.TargetType, body.TargetID, body.Reason, body.Details)
	if err != nil {
		if err.Error() == "duplicate open report" {
			respondWithError(w, http.StatusConflict, "Вы уже отправили жалобу по этому обращению")
			return
		}
		log.Printf("CreateAbuseReport: %v", err)
		respondWithError(w, http.StatusInternalServerError, "Не удалось сохранить жалобу. Перезапустите backend после обновления.")
		return
	}
	respondWithJSON(w, http.StatusCreated, map[string]interface{}{"status": "success", "id": id})
}

func RealtimeStatsHandler(w http.ResponseWriter, r *http.Request) {
	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"moderators_online": realtime.ModeratorOnlineCount(),
		"postgis":           database.PostGISAvailable(),
	})
}
