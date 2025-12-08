package handlers

import (
	"backend/database"
	"encoding/json"
	"net/http"
	"time"
)

func GetMarkers(w http.ResponseWriter, r *http.Request) {
	rows, err := database.DB.Query(`
        SELECT m.id, m.user_id, m.title, m.description, 
               m.latitude, m.longitude, m.category, m.status,
               m.created_at, m.updated_at, u.email as user_email
        FROM markers m
        JOIN users u ON m.user_id = u.id
        ORDER BY m.created_at DESC
    `)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	markers := []map[string]interface{}{}
	for rows.Next() {
		var m struct {
			ID          int       `json:"id"`
			UserID      int       `json:"user_id"`
			Title       string    `json:"title"`
			Description string    `json:"description"`
			Latitude    float64   `json:"latitude"`
			Longitude   float64   `json:"longitude"`
			Category    string    `json:"category"`
			Status      string    `json:"status"`
			CreatedAt   time.Time `json:"created_at"`
			UpdatedAt   time.Time `json:"updated_at"`
			UserEmail   string    `json:"user_email"`
		}

		err := rows.Scan(&m.ID, &m.UserID, &m.Title, &m.Description,
			&m.Latitude, &m.Longitude, &m.Category, &m.Status,
			&m.CreatedAt, &m.UpdatedAt, &m.UserEmail)
		if err != nil {
			continue
		}

		var commentCount int
		database.DB.QueryRow("SELECT COUNT(*) FROM comments WHERE marker_id = $1", m.ID).Scan(&commentCount)

		markers = append(markers, map[string]interface{}{
			"id":            m.ID,
			"user_id":       m.UserID,
			"title":         m.Title,
			"description":   m.Description,
			"latitude":      m.Latitude,
			"longitude":     m.Longitude,
			"category":      m.Category,
			"status":        m.Status,
			"created_at":    m.CreatedAt,
			"updated_at":    m.UpdatedAt,
			"user_email":    m.UserEmail,
			"comment_count": commentCount,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(markers)
}

func CreateMarker(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(int)

	var marker struct {
		Title       string  `json:"title"`
		Description string  `json:"description"`
		Latitude    float64 `json:"latitude"`
		Longitude   float64 `json:"longitude"`
		Category    string  `json:"category"`
	}

	if err := json.NewDecoder(r.Body).Decode(&marker); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	// Валидация
	if marker.Title == "" || marker.Latitude == 0 || marker.Longitude == 0 {
		http.Error(w, "Title and coordinates are required", http.StatusBadRequest)
		return
	}

	var id int
	err := database.DB.QueryRow(
		`INSERT INTO markers (user_id, title, description, latitude, longitude, category)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
		userID, marker.Title, marker.Description, marker.Latitude,
		marker.Longitude, marker.Category,
	).Scan(&id)

	if err != nil {
		http.Error(w, "Database error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":      id,
		"success": true,
		"message": "Marker created successfully",
	})
}
