package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"backend/database"
	"backend/middleware"
	"github.com/gorilla/mux"
)

func CreateComment(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var comment struct {
		MarkerID int    `json:"marker_id"`
		Text     string `json:"text"`
	}

	if err := json.NewDecoder(r.Body).Decode(&comment); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	if comment.Text == "" {
		http.Error(w, "Comment text is required", http.StatusBadRequest)
		return
	}

	var markerExists bool
	err := database.DB.QueryRow(
		"SELECT EXISTS(SELECT 1 FROM markers WHERE id = $1)",
		comment.MarkerID,
	).Scan(&markerExists)

	if err != nil || !markerExists {
		http.Error(w, "Marker not found", http.StatusNotFound)
		return
	}

	var id int
	err = database.DB.QueryRow(
		`INSERT INTO comments (user_id, marker_id, text) 
         VALUES ($1, $2, $3) RETURNING id`,
		userID, comment.MarkerID, comment.Text,
	).Scan(&id)

	if err != nil {
		http.Error(w, "Database error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":         id,
		"user_id":    userID,
		"marker_id":  comment.MarkerID,
		"text":       comment.Text,
		"created_at": time.Now().Format(time.RFC3339),
		"status":     "success",
	})
}

func GetComments(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	markerID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid marker ID", http.StatusBadRequest)
		return
	}

	rows, err := database.DB.Query(`
        SELECT c.id, c.user_id, c.marker_id, c.text, c.created_at, u.email
        FROM comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.marker_id = $1
        ORDER BY c.created_at DESC
    `, markerID)

	if err != nil {
		http.Error(w, "Database error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	comments := []map[string]interface{}{}
	for rows.Next() {
		var c struct {
			ID        int       `json:"id"`
			UserID    int       `json:"user_id"`
			MarkerID  int       `json:"marker_id"`
			Text      string    `json:"text"`
			CreatedAt time.Time `json:"created_at"`
			UserEmail string    `json:"user_email"`
		}

		err := rows.Scan(&c.ID, &c.UserID, &c.MarkerID, &c.Text, &c.CreatedAt, &c.UserEmail)
		if err != nil {
			continue
		}

		comments = append(comments, map[string]interface{}{
			"id":         c.ID,
			"user_id":    c.UserID,
			"marker_id":  c.MarkerID,
			"text":       c.Text,
			"created_at": c.CreatedAt.Format(time.RFC3339),
			"user_email": c.UserEmail,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"comments": comments,
		"count":    len(comments),
		"status":   "success",
	})
}
