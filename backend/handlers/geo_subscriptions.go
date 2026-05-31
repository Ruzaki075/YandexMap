package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"backend/database"
	"backend/middleware"

	"github.com/gorilla/mux"
)

func ListGeoSubscriptionsHandler(w http.ResponseWriter, r *http.Request) {
	uid, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	rows, err := database.DB.Query(`
		SELECT id, user_id, label, latitude, longitude, radius_m, notify_new, notify_resolved, created_at
		FROM geo_subscriptions WHERE user_id = $1 ORDER BY created_at DESC`, uid)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}
	defer rows.Close()
	var list []map[string]interface{}
	for rows.Next() {
		var id, userID, radiusM int
		var label string
		var lat, lng float64
		var notifyNew, notifyResolved bool
		var createdAt time.Time
		if err := rows.Scan(&id, &userID, &label, &lat, &lng, &radiusM, &notifyNew, &notifyResolved, &createdAt); err != nil {
			continue
		}
		list = append(list, map[string]interface{}{
			"id":              id,
			"user_id":         userID,
			"label":           label,
			"latitude":        lat,
			"longitude":       lng,
			"radius_m":        radiusM,
			"notify_new":      notifyNew,
			"notify_resolved": notifyResolved,
			"created_at":      createdAt.UTC().Format(time.RFC3339),
		})
	}
	if list == nil {
		list = []map[string]interface{}{}
	}
	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"status":        "success",
		"subscriptions": list,
		"count":         len(list),
	})
}

func CreateGeoSubscriptionHandler(w http.ResponseWriter, r *http.Request) {
	uid, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	var body struct {
		Label          string  `json:"label"`
		Latitude       float64 `json:"latitude"`
		Longitude      float64 `json:"longitude"`
		RadiusM        int     `json:"radius_m"`
		NotifyNew      *bool   `json:"notify_new"`
		NotifyResolved *bool   `json:"notify_resolved"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid JSON")
		return
	}
	if body.RadiusM < 100 {
		body.RadiusM = 500
	}
	if body.RadiusM > 5000 {
		body.RadiusM = 5000
	}
	notifyNew := true
	notifyResolved := true
	if body.NotifyNew != nil {
		notifyNew = *body.NotifyNew
	}
	if body.NotifyResolved != nil {
		notifyResolved = *body.NotifyResolved
	}
	var id int
	err := database.DB.QueryRow(`
		INSERT INTO geo_subscriptions (user_id, label, latitude, longitude, radius_m, notify_new, notify_resolved)
		VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
		uid, strings.TrimSpace(body.Label), body.Latitude, body.Longitude,
		body.RadiusM, notifyNew, notifyResolved,
	).Scan(&id)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}
	respondWithJSON(w, http.StatusCreated, map[string]interface{}{
		"status": "success",
		"id":     id,
	})
}

func DeleteGeoSubscriptionHandler(w http.ResponseWriter, r *http.Request) {
	uid, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	id, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil || id <= 0 {
		respondWithError(w, http.StatusBadRequest, "Invalid id")
		return
	}
	res, err := database.DB.Exec(
		`DELETE FROM geo_subscriptions WHERE id = $1 AND user_id = $2`, id, uid)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		respondWithError(w, http.StatusNotFound, "Not found")
		return
	}
	respondWithJSON(w, http.StatusOK, map[string]string{"status": "success"})
}
