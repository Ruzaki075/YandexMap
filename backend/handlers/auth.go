package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"backend/database"
	"backend/middleware"
	"github.com/dgrijalva/jwt-go"
	"golang.org/x/crypto/bcrypt"
)

func RegisterHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	if req.Email == "" || req.Password == "" {
		http.Error(w, "Email and password required", http.StatusBadRequest)
		return
	}

	hashedPassword, _ := bcrypt.GenerateFromPassword([]byte(req.Password), 14)

	var id int
	var createdAt time.Time
	err := database.DB.QueryRow(
		"INSERT INTO users(email, password) VALUES($1, $2) RETURNING id, created_at",
		req.Email, string(hashedPassword),
	).Scan(&id, &createdAt)

	if err != nil {
		if err.Error() == "pq: duplicate key value violates unique constraint \"users_email_key\"" {
			http.Error(w, "User already exists", http.StatusConflict)
		} else {
			http.Error(w, "Server error: "+err.Error(), http.StatusInternalServerError)
		}
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "User registered successfully",
		"user": map[string]interface{}{
			"id":            id,
			"email":         req.Email,
			"is_moderator":  false,
			"is_admin":      false,
			"created_at":    createdAt.UTC().Format(time.RFC3339),
		},
		"status": "success",
	})
}

func LoginHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	var userID int
	var hashedPassword string
	var isModerator bool
	var isAdmin bool
	err := database.DB.QueryRow(
		`SELECT id, password, COALESCE(is_moderator, FALSE), COALESCE(is_admin, FALSE)
		 FROM users WHERE email = $1`,
		req.Email,
	).Scan(&userID, &hashedPassword, &isModerator, &isAdmin)

	if err == sql.ErrNoRows {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	} else if err != nil {
		http.Error(w, "Server error", http.StatusInternalServerError)
		return
	}

	if bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(req.Password)) != nil {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	expirationTime := time.Now().Add(24 * time.Hour)
	claims := &middleware.Claims{
		UserID:      userID,
		Email:       req.Email,
		IsModerator: isModerator,
		IsAdmin:     isAdmin,
		StandardClaims: jwt.StandardClaims{
			ExpiresAt: expirationTime.Unix(),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	tokenString, err := token.SignedString(middleware.JwtKey)
	if err != nil {
		http.Error(w, "Failed to generate token", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	user, err := LoadUserPublic(userID)
	if err != nil {
		http.Error(w, "Server error", http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Login successful",
		"token":   tokenString,
		"user":    user,
		"status":  "success",
	})
}

func LogoutHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Logged out successfully",
		"status":  "success",
	})
}

// MeHandler — текущий пользователь и роли из БД + новый JWT (актуальные is_admin / is_moderator).
func MeHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	var email string
	var isModerator, isAdmin bool
	err := database.DB.QueryRow(
		`SELECT email, COALESCE(is_moderator, FALSE), COALESCE(is_admin, FALSE)
		 FROM users WHERE id = $1`,
		userID,
	).Scan(&email, &isModerator, &isAdmin)
	if err == sql.ErrNoRows {
		respondWithError(w, http.StatusNotFound, "User not found")
		return
	}
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}

	expirationTime := time.Now().Add(24 * time.Hour)
	claims := &middleware.Claims{
		UserID:      userID,
		Email:       email,
		IsModerator: isModerator,
		IsAdmin:     isAdmin,
		StandardClaims: jwt.StandardClaims{
			ExpiresAt: expirationTime.Unix(),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString(middleware.JwtKey)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to generate token")
		return
	}

	user, err := LoadUserPublic(userID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"status": "success",
		"token":  tokenString,
		"user":   user,
	})
}

// ChangePasswordHandler — смена пароля (требует JWT).
func ChangePasswordHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	var req struct {
		OldPassword string `json:"old_password"`
		NewPassword string `json:"new_password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid JSON")
		return
	}
	req.OldPassword = strings.TrimSpace(req.OldPassword)
	req.NewPassword = strings.TrimSpace(req.NewPassword)
	if req.OldPassword == "" || len(req.NewPassword) < 6 {
		respondWithError(w, http.StatusBadRequest, "Укажите текущий пароль и новый (не короче 6 символов)")
		return
	}
	var hashed string
	err := database.DB.QueryRow(`SELECT password FROM users WHERE id = $1`, userID).Scan(&hashed)
	if err == sql.ErrNoRows {
		respondWithError(w, http.StatusNotFound, "User not found")
		return
	}
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}
	if bcrypt.CompareHashAndPassword([]byte(hashed), []byte(req.OldPassword)) != nil {
		respondWithError(w, http.StatusUnauthorized, "Неверный текущий пароль")
		return
	}
	newHash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), 14)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Server error")
		return
	}
	if _, err := database.DB.Exec(`UPDATE users SET password = $1 WHERE id = $2`, string(newHash), userID); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}
	respondWithJSON(w, http.StatusOK, map[string]interface{}{"status": "success", "message": "Пароль обновлён"})
}
