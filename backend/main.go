package main

import (
	"database/sql"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/gorilla/mux"
	_ "github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
)

var db *sql.DB

func main() {
	initDB()
	defer db.Close()

	r := mux.NewRouter()

	r.Use(corsMiddleware)

	r.PathPrefix("/uploads/").Handler(http.StripPrefix("/uploads/", http.FileServer(http.Dir("./uploads"))))

	r.HandleFunc("/api/register", registerHandler).Methods("POST")
	r.HandleFunc("/api/login", loginHandler).Methods("POST")
	r.HandleFunc("/api/logout", logoutHandler).Methods("POST")
	r.HandleFunc("/api/markers", getMarkersHandler).Methods("GET")
	r.HandleFunc("/api/markers", createMarkerHandler).Methods("POST")
	r.HandleFunc("/api/markers/{id}", deleteMarkerHandler).Methods("DELETE")
	r.HandleFunc("/api/profile", profileHandler).Methods("GET")
	r.HandleFunc("/api/upload", uploadImageHandler).Methods("POST")

	r.PathPrefix("/").HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		http.NotFound(w, r)
	}).Methods("OPTIONS")

	port := ":8080"
	log.Printf(" Server running on http://localhost%s", port)
	log.Fatal(http.ListenAndServe(port, r))
}

type RegisterRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

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
}

func registerHandler(w http.ResponseWriter, r *http.Request) {
	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid JSON")
		return
	}

	if req.Email == "" || req.Password == "" {
		respondWithError(w, http.StatusBadRequest, "Email and password are required")
		return
	}

	hashedPassword, err := hashPassword(req.Password)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Server error")
		return
	}

	var id int
	err = db.QueryRow(
		"INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id",
		req.Email, hashedPassword,
	).Scan(&id)

	if err != nil {
		if err.Error() == "pq: duplicate key value violates unique constraint \"users_email_key\"" {
			respondWithError(w, http.StatusConflict, "Email already registered")
		} else {
			respondWithError(w, http.StatusInternalServerError, "Database error")
		}
		return
	}

	respondWithJSON(w, http.StatusCreated, map[string]interface{}{
		"message": "User registered successfully",
		"user": map[string]interface{}{
			"id":    id,
			"email": req.Email,
		},
		"status": "success",
	})
}

func loginHandler(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid JSON")
		return
	}

	if req.Email == "" || req.Password == "" {
		respondWithError(w, http.StatusBadRequest, "Email and password are required")
		return
	}

	var userID int
	var hashedPassword string
	err := db.QueryRow(
		"SELECT id, password FROM users WHERE email = $1",
		req.Email,
	).Scan(&userID, &hashedPassword)

	if err == sql.ErrNoRows {
		respondWithError(w, http.StatusUnauthorized, "Invalid email or password")
		return
	} else if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}

	if !checkPasswordHash(req.Password, hashedPassword) {
		respondWithError(w, http.StatusUnauthorized, "Invalid email or password")
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Login successful",
		"user": map[string]interface{}{
			"id":    userID,
			"email": req.Email,
		},
		"status": "success",
	})
}

func logoutHandler(w http.ResponseWriter, r *http.Request) {
	respondWithJSON(w, http.StatusOK, map[string]string{
		"message": "Logged out successfully",
		"status":  "success",
	})
}

func getMarkersHandler(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query(`
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

func createMarkerHandler(w http.ResponseWriter, r *http.Request) {
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

	userID := 1

	var id int
	err := db.QueryRow(
		`INSERT INTO markers (user_id, text, latitude, longitude, image_url, status)
		 VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING id`,
		userID, req.Text, req.Latitude, req.Longitude, req.ImageURL,
	).Scan(&id)

	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error: "+err.Error())
		return
	}

	respondWithJSON(w, http.StatusCreated, map[string]interface{}{
		"message": "Marker created successfully",
		"status":  "success",
	})
}

func deleteMarkerHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	_, err := db.Exec("DELETE FROM markers WHERE id = $1", id)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{
		"message": "Marker deleted successfully",
		"status":  "success",
	})
}

func profileHandler(w http.ResponseWriter, r *http.Request) {
	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"id":            1,
		"email":         "test@example.com",
		"created_at":    time.Now().Format(time.RFC3339),
		"markers_count": 0,
	})
}

func uploadImageHandler(w http.ResponseWriter, r *http.Request) {
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

func initDB() {
	connStr := "host=localhost port=5432 user=postgres password=Chernig007or dbname=yandexmap sslmode=disable"
	var err error
	db, err = sql.Open("postgres", connStr)
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	err = db.Ping()
	if err != nil {
		log.Fatal("Failed to ping database:", err)
	}

	createTables()
	log.Println("Database connected successfully")
}

func createTables() {
	db.Exec(`DROP TABLE IF EXISTS markers CASCADE`)
	db.Exec(`DROP TABLE IF EXISTS users CASCADE`)

	db.Exec(`
		CREATE TABLE users (
			id SERIAL PRIMARY KEY,
			email VARCHAR(255) UNIQUE NOT NULL,
			password VARCHAR(255) NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)
	`)

	db.Exec(`
		CREATE TABLE markers (
			id SERIAL PRIMARY KEY,
			user_id INTEGER REFERENCES users(id),
			text TEXT NOT NULL,
			description TEXT,
			latitude DECIMAL(10, 8) NOT NULL,
			longitude DECIMAL(11, 8) NOT NULL,
			image_url TEXT,
			category VARCHAR(100),
			status VARCHAR(50) DEFAULT 'pending',
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)
	`)

	hashedPassword, _ := hashPassword("admin123")
	db.Exec("INSERT INTO users (email, password) VALUES ($1, $2)", "admin@test.com", hashedPassword)
}

func hashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), 14)
	return string(bytes), err
}

func checkPasswordHash(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
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

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {

		w.Header().Set("Access-Control-Allow-Origin", "http://localhost:5173")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
		w.Header().Set("Access-Control-Allow-Credentials", "true")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}
