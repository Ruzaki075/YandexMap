package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"time"

	_ "github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
)

var db *sql.DB

func main() {
	initDB()
	defer db.Close()

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}
		w.Write([]byte("Сервер работает! Map Issues API v1.0"))
	})

	http.HandleFunc("/api/test", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"message": "API тест успешен",
			"status":  "working",
			"version": "1.0",
		})
	})

	http.HandleFunc("/api/register", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var data map[string]string
		if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
			http.Error(w, "Invalid JSON", http.StatusBadRequest)
			return
		}

		email := data["email"]
		password := data["password"]

		if email == "" || password == "" {
			http.Error(w, "Email and password are required", http.StatusBadRequest)
			return
		}

		hashedPassword, err := hashPassword(password)
		if err != nil {
			http.Error(w, "Server error", http.StatusInternalServerError)
			return
		}

		var id int
		err = db.QueryRow(
			"INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id",
			email, hashedPassword,
		).Scan(&id)

		if err != nil {
			if err.Error() == "pq: duplicate key value violates unique constraint \"users_email_key\"" {
				http.Error(w, "Email already registered", http.StatusConflict)
			} else {
				http.Error(w, "Database error: "+err.Error(), http.StatusInternalServerError)
			}
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"message": "User registered successfully",
			"email":   email,
			"id":      id,
			"status":  "success",
		})
	})

	http.HandleFunc("/api/login", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var data map[string]string
		if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
			http.Error(w, "Invalid JSON", http.StatusBadRequest)
			return
		}

		email := data["email"]
		password := data["password"]

		if email == "" || password == "" {
			http.Error(w, "Email and password are required", http.StatusBadRequest)
			return
		}

		var userID int
		var hashedPassword string
		err := db.QueryRow(
			"SELECT id, password FROM users WHERE email = $1",
			email,
		).Scan(&userID, &hashedPassword)

		if err == sql.ErrNoRows {
			http.Error(w, "Invalid email or password", http.StatusUnauthorized)
			return
		} else if err != nil {
			http.Error(w, "Database error", http.StatusInternalServerError)
			return
		}

		if !checkPasswordHash(password, hashedPassword) {
			http.Error(w, "Invalid email or password", http.StatusUnauthorized)
			return
		}

		token := "test-jwt-token-123"

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"message": "Login successful",
			"email":   email,
			"user_id": userID,
			"token":   token,
			"status":  "success",
		})
	})

	http.HandleFunc("/api/markers", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "GET" {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		rows, err := db.Query(`
			SELECT m.id, m.user_id, m.title, m.description, 
				   m.latitude, m.longitude, m.category, m.status,
				   m.created_at, m.updated_at, u.email as user_email
			FROM markers m
			LEFT JOIN users u ON m.user_id = u.id
			ORDER BY m.created_at DESC
		`)
		if err != nil {
			http.Error(w, "Database error: "+err.Error(), http.StatusInternalServerError)
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
				UserEmail   *string   `json:"user_email"`
			}

			err := rows.Scan(&m.ID, &m.UserID, &m.Title, &m.Description,
				&m.Latitude, &m.Longitude, &m.Category, &m.Status,
				&m.CreatedAt, &m.UpdatedAt, &m.UserEmail)
			if err != nil {
				log.Printf("Error scanning row: %v", err)
				continue
			}

			userEmail := ""
			if m.UserEmail != nil {
				userEmail = *m.UserEmail
			}

			markers = append(markers, map[string]interface{}{
				"id":          m.ID,
				"user_id":     m.UserID,
				"title":       m.Title,
				"description": m.Description,
				"latitude":    m.Latitude,
				"longitude":   m.Longitude,
				"category":    m.Category,
				"status":      m.Status,
				"created_at":  m.CreatedAt.Format(time.RFC3339),
				"updated_at":  m.UpdatedAt.Format(time.RFC3339),
				"user_email":  userEmail,
			})
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"count":   len(markers),
			"markers": markers,
		})
	})

	http.HandleFunc("/api/markers/create", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var data map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
			http.Error(w, "Invalid JSON", http.StatusBadRequest)
			return
		}

		title, _ := data["title"].(string)
		description, _ := data["description"].(string)

		if title == "" {
			http.Error(w, "Title is required", http.StatusBadRequest)
			return
		}

		var latitude, longitude float64

		if lat, ok := data["latitude"].(float64); ok {
			latitude = lat
		} else if latStr, ok := data["latitude"].(string); ok {
			if lat, err := strconv.ParseFloat(latStr, 64); err == nil {
				latitude = lat
			}
		}

		if lon, ok := data["longitude"].(float64); ok {
			longitude = lon
		} else if lonStr, ok := data["longitude"].(string); ok {
			if lon, err := strconv.ParseFloat(lonStr, 64); err == nil {
				longitude = lon
			}
		}

		if latitude == 0 || longitude == 0 {
			http.Error(w, "Valid latitude and longitude are required", http.StatusBadRequest)
			return
		}

		category, _ := data["category"].(string)
		if category == "" {
			category = "other"
		}

		userID := 1

		var id int
		err := db.QueryRow(
			`INSERT INTO markers (user_id, title, description, latitude, longitude, category)
			 VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
			userID, title, description, latitude, longitude, category,
		).Scan(&id)

		if err != nil {
			log.Printf("Database error: %v", err)
			http.Error(w, "Database error: "+err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"id":      id,
			"message": "Marker created successfully",
			"status":  "success",
			"marker": map[string]interface{}{
				"id":          id,
				"title":       title,
				"description": description,
				"latitude":    latitude,
				"longitude":   longitude,
				"category":    category,
				"user_id":     userID,
			},
		})
	})

	http.HandleFunc("/api/profile", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "GET" {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"id":            1,
			"email":         "test@example.com",
			"created_at":    time.Now().Format(time.RFC3339),
			"markers_count": 5,
		})
	})

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		http.DefaultServeMux.ServeHTTP(w, r)
	})

	port := ":8080"
	log.Printf("Сервер запущен на http://localhost%s", port)

	log.Fatal(http.ListenAndServe(port, handler))
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

	recreateTables()
	log.Println("Database connected successfully")
}

func recreateTables() {
	dropQueries := []string{
		`DROP TABLE IF EXISTS votes CASCADE`,
		`DROP TABLE IF EXISTS comments CASCADE`,
		`DROP TABLE IF EXISTS markers CASCADE`,
		`DROP TABLE IF EXISTS users CASCADE`,
	}

	for _, query := range dropQueries {
		_, err := db.Exec(query)
		if err != nil {
			log.Printf("Warning dropping table: %v", err)
		}
	}

	_, err := db.Exec(`
		CREATE TABLE users (
			id SERIAL PRIMARY KEY,
			email VARCHAR(255) UNIQUE NOT NULL,
			password VARCHAR(255) NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)
	`)
	if err != nil {
		log.Printf("Error creating users table: %v", err)
	}

	_, err = db.Exec(`
		CREATE TABLE markers (
			id SERIAL PRIMARY KEY,
			user_id INTEGER REFERENCES users(id),
			title VARCHAR(255) NOT NULL,
			description TEXT,
			latitude DECIMAL(10, 8) NOT NULL,
			longitude DECIMAL(11, 8) NOT NULL,
			category VARCHAR(100),
			status VARCHAR(50) DEFAULT 'pending',
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)
	`)
	if err != nil {
		log.Printf("Error creating markers table: %v", err)
	}

	hashedPassword, _ := hashPassword("admin123")
	db.Exec("INSERT INTO users (email, password) VALUES ($1, $2)", "admin@test.com", hashedPassword)

	db.Exec(`
		INSERT INTO markers (user_id, title, description, latitude, longitude, category)
		VALUES (1, 'Тестовый маркер', 'Это тестовый маркер для проверки', 55.7558, 37.6173, 'тест')
	`)
}

func hashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), 14)
	return string(bytes), err
}

func checkPasswordHash(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}
