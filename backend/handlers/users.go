package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"time"

	"backend/database"
	"backend/middleware"
)

func Profile(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var user struct {
		ID        int       `json:"id"`
		Email     string    `json:"email"`
		CreatedAt time.Time `json:"created_at"`
	}

	err := database.DB.QueryRow(
		"SELECT id, email, created_at FROM users WHERE id = $1",
		userID,
	).Scan(&user.ID, &user.Email, &user.CreatedAt)

	if err == sql.ErrNoRows {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	} else if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	var stats struct {
		TotalMarkers    int `json:"total_markers"`
		PendingMarkers  int `json:"pending_markers"`
		ResolvedMarkers int `json:"resolved_markers"`
	}

	database.DB.QueryRow(`
		SELECT 
			COUNT(*) as total,
			COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
			COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved
		FROM markers 
		WHERE user_id = $1
	`, userID).Scan(&stats.TotalMarkers, &stats.PendingMarkers, &stats.ResolvedMarkers)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":               user.ID,
		"email":            user.Email,
		"created_at":       user.CreatedAt.Format(time.RFC3339),
		"total_markers":    stats.TotalMarkers,
		"pending_markers":  stats.PendingMarkers,
		"resolved_markers": stats.ResolvedMarkers,
		"status":           "success",
	})
}
