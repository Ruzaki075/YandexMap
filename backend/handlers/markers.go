package handlers

import (
	"database/sql"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"backend/database"
	"github.com/gorilla/mux"
)

type Marker struct {
	ID        int       `json:"id"`
	UserID    int       `json:"user_id"`
	Text      string    `json:"text"`
	Latitude  float64   `json:"latitude"`
	Longitude float64   `json:"longitude"`
	ImageURL  string    `json:"image_url,omitempty"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	UserEmail string    `json:"user_email,omitempty"`
}

type CreateMarkerRequest struct {
	Text      string  `json:"text"`
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	ImageURL  string  `json:"image_url,omitempty"`
	UserID    int     `json:"user_id"`
}

func GetMarkersHandler(w http.ResponseWriter, r *http.Request) {
	rows, err := database.DB.Query(`
		SELECT m.id, m.user_id, m.text, m.latitude, m.longitude, 
			   m.image_url, m.status, m.created_at, m.updated_at, u.email
		FROM markers m
		LEFT JOIN users u ON m.user_id = u.id
		ORDER BY m.created_at DESC
	`)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error: "+err.Error())
		return
	}
	defer rows.Close()

	markers := []Marker{}
	for rows.Next() {
		var m Marker
		var imageURL sql.NullString
		var userEmail sql.NullString

		err := rows.Scan(&m.ID, &m.UserID, &m.Text, &m.Latitude, &m.Longitude,
			&imageURL, &m.Status, &m.CreatedAt, &m.UpdatedAt, &userEmail)
		if err != nil {
			continue
		}

		if imageURL.Valid {
			m.ImageURL = imageURL.String
		}
		if userEmail.Valid {
			m.UserEmail = userEmail.String
		}

		markers = append(markers, m)
	}

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"markers": markers,
		"count":   len(markers),
	})
}

func CreateMarkerHandler(w http.ResponseWriter, r *http.Request) {
	var req CreateMarkerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid JSON")
		return
	}

	if req.Text == "" {
		respondWithError(w, http.StatusBadRequest, "Text is required")
		return
	}

	if req.Latitude == 0 || req.Longitude == 0 {
		respondWithError(w, http.StatusBadRequest, "Coordinates are required")
		return
	}

	var userExists bool
	err := database.DB.QueryRow("SELECT EXISTS(SELECT 1 FROM users WHERE id = $1)", req.UserID).Scan(&userExists)
	if err != nil || !userExists {
		respondWithError(w, http.StatusBadRequest, "User not found")
		return
	}

	var id int
	err = database.DB.QueryRow(
		`INSERT INTO markers (user_id, text, latitude, longitude, image_url, status)
		 VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING id`,
		req.UserID, req.Text, req.Latitude, req.Longitude, req.ImageURL,
	).Scan(&id)

	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error: "+err.Error())
		return
	}

	var userEmail string
	database.DB.QueryRow("SELECT email FROM users WHERE id = $1", req.UserID).Scan(&userEmail)

	respondWithJSON(w, http.StatusCreated, map[string]interface{}{
		"message": "Marker created successfully",
		"status":  "success",
		"marker": map[string]interface{}{
			"id":         id,
			"user_id":    req.UserID,
			"user_email": userEmail,
			"text":       req.Text,
		},
	})
}

func DeleteMarkerHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	_, err := database.DB.Exec("DELETE FROM markers WHERE id = $1", id)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{
		"message": "Marker deleted successfully",
		"status":  "success",
	})
}

func UploadImageHandler(w http.ResponseWriter, r *http.Request) {
	err := r.ParseMultipartForm(10 << 20)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "File too large (max 10MB)")
		return
	}

	file, handler, err := r.FormFile("image")
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "No image file provided")
		return
	}
	defer file.Close()

	if err := os.MkdirAll("uploads", 0755); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to create upload directory")
		return
	}

	filename := strconv.FormatInt(time.Now().UnixNano(), 10) + "_" + handler.Filename
	path := filepath.Join("uploads", filename)

	dst, err := os.Create(path)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to save file")
		return
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to save file")
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"message":   "Image uploaded successfully",
		"image_url": "/uploads/" + filename,
		"status":    "success",
	})
}

func respondWithJSON(w http.ResponseWriter, code int, payload interface{}) {
	response, _ := json.Marshal(payload)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	w.Write(response)
}

func respondWithError(w http.ResponseWriter, code int, message string) {
	respondWithJSON(w, code, map[string]string{"error": message})
}
