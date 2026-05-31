package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"backend/database"
	"backend/middleware"
	"backend/repositories"

	"github.com/gorilla/mux"
)

func CreateMarkerCommentHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	markerID, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil || markerID <= 0 {
		respondWithError(w, http.StatusBadRequest, "Invalid marker id")
		return
	}
	var body struct {
		Text string `json:"text"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid JSON")
		return
	}
	text := strings.TrimSpace(body.Text)
	if text == "" {
		respondWithError(w, http.StatusBadRequest, "Comment text is required")
		return
	}
	if len(text) > 2000 {
		respondWithError(w, http.StatusBadRequest, "Comment too long")
		return
	}

	var markerExists bool
	err = database.DB.QueryRow(
		"SELECT EXISTS(SELECT 1 FROM markers WHERE id = $1)",
		markerID,
	).Scan(&markerExists)
	if err != nil || !markerExists {
		respondWithError(w, http.StatusNotFound, "Marker not found")
		return
	}

	var id int
	err = database.DB.QueryRow(
		`INSERT INTO comments (user_id, marker_id, text) VALUES ($1, $2, $3) RETURNING id`,
		userID, markerID, text,
	).Scan(&id)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}

	mrepo := repositories.NewMarkerRepository()
	ownerID, errOwner := mrepo.GetMarkerOwnerUserID(markerID)
	if errOwner == nil && ownerID > 0 && ownerID != userID {
		_, _, snippet, _ := mrepo.GetMarkerNotifyMeta(markerID)
		snip := snippet
		if len([]rune(snip)) > 120 {
			r := []rune(snip)
			snip = string(r[:120]) + "…"
		}
		nrepo := repositories.NewNotificationRepository()
		mid := markerID
		_, _ = nrepo.Create(ownerID, "marker_comment", &mid, "Новый комментарий",
			"К вашему обращению добавили комментарий.\n\n«"+snip+"»")
	}

	respondWithJSON(w, http.StatusCreated, map[string]interface{}{
		"status":     "success",
		"id":         id,
		"user_id":    userID,
		"marker_id":  markerID,
		"text":       text,
		"created_at": time.Now().UTC().Format(time.RFC3339),
	})
}

func GetComments(w http.ResponseWriter, r *http.Request) {
	markerID, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil || markerID <= 0 {
		respondWithError(w, http.StatusBadRequest, "Invalid marker id")
		return
	}

	rows, err := database.DB.Query(`
        SELECT c.id, c.user_id, c.marker_id, c.text, c.created_at,
               COALESCE(NULLIF(TRIM(u.display_name), ''), u.email)
        FROM comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.marker_id = $1
        ORDER BY c.created_at ASC
    `, markerID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}
	defer rows.Close()

	comments := []map[string]interface{}{}
	for rows.Next() {
		var c struct {
			ID        int
			UserID    int
			MarkerID  int
			Text      string
			CreatedAt time.Time
			UserEmail string
		}
		if err := rows.Scan(&c.ID, &c.UserID, &c.MarkerID, &c.Text, &c.CreatedAt, &c.UserEmail); err != nil {
			continue
		}
		comments = append(comments, map[string]interface{}{
			"id":         c.ID,
			"user_id":    c.UserID,
			"marker_id":  c.MarkerID,
			"text":       c.Text,
			"created_at": c.CreatedAt.UTC().Format(time.RFC3339),
			"user_email": c.UserEmail,
		})
	}

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"comments": comments,
		"count":    len(comments),
		"status":   "success",
	})
}
