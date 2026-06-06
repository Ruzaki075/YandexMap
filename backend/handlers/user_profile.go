package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"backend/database"
	"backend/middleware"
)

const avatarMaxBytes = 2 << 20 // 2 MB

var allowedAvatarExt = map[string]bool{
	".jpg": true, ".jpeg": true, ".png": true, ".webp": true, ".gif": true,
}

// UploadAvatarHandler — загрузка аватара текущего пользователя.
func UploadAvatarHandler(w http.ResponseWriter, r *http.Request) {
	uid, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	if err := r.ParseMultipartForm(avatarMaxBytes + 512); err != nil {
		respondWithError(w, http.StatusBadRequest, "File too large")
		return
	}
	file, handler, err := r.FormFile("image")
	if err != nil || handler == nil {
		respondWithError(w, http.StatusBadRequest, "Поле image обязательно")
		return
	}
	defer file.Close()

	ext := strings.ToLower(filepath.Ext(handler.Filename))
	if !allowedAvatarExt[ext] {
		respondWithError(w, http.StatusBadRequest, "Допустимы JPG, PNG, WEBP, GIF")
		return
	}

	limited := io.LimitReader(file, avatarMaxBytes+1)
	buf, err := io.ReadAll(limited)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Cannot read file")
		return
	}
	if len(buf) > avatarMaxBytes {
		respondWithError(w, http.StatusBadRequest, "Файл больше 2 МБ")
		return
	}

	var oldURL sql.NullString
	_ = database.DB.QueryRow(`SELECT avatar_url FROM users WHERE id = $1`, uid).Scan(&oldURL)

	os.MkdirAll("uploads/avatars", 0755)
	name := strconv.Itoa(uid) + "_" + strconv.FormatInt(time.Now().UnixNano(), 10) + ext
	path := filepath.Join("uploads", "avatars", name)
	if err := os.WriteFile(path, buf, 0644); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Cannot save file")
		return
	}

	url := "/uploads/avatars/" + name
	if _, err := database.DB.Exec(`UPDATE users SET avatar_url = $1 WHERE id = $2`, url, uid); err != nil {
		_ = os.Remove(path)
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}

	if oldURL.Valid && oldURL.String != "" {
		removeAvatarFile(oldURL.String)
	}

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"status":     "success",
		"avatar_url": url,
	})
}

// DeleteAvatarHandler — удалить аватар.
func DeleteAvatarHandler(w http.ResponseWriter, r *http.Request) {
	uid, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	var oldURL sql.NullString
	err := database.DB.QueryRow(`SELECT avatar_url FROM users WHERE id = $1`, uid).Scan(&oldURL)
	if err == sql.ErrNoRows {
		respondWithError(w, http.StatusNotFound, "User not found")
		return
	}
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}
	_, _ = database.DB.Exec(`UPDATE users SET avatar_url = NULL WHERE id = $1`, uid)
	if oldURL.Valid && oldURL.String != "" {
		removeAvatarFile(oldURL.String)
	}
	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"status":     "success",
		"avatar_url": nil,
	})
}

func removeAvatarFile(url string) {
	url = strings.TrimSpace(url)
	if url == "" || !strings.HasPrefix(url, "/uploads/") {
		return
	}
	rel := strings.TrimPrefix(url, "/")
	_ = os.Remove(filepath.FromSlash(rel))
}

// LoadUserPublic — поля пользователя для клиента (логин, /me).
func LoadUserPublic(userID int) (map[string]interface{}, error) {
	var email, displayName string
	var isMod, isAdmin, isDeptRep bool
	var deptID sql.NullInt64
	var createdAt time.Time
	var avatarURL sql.NullString
	err := database.DB.QueryRow(`
		SELECT email, COALESCE(display_name, ''), COALESCE(is_moderator, FALSE),
		       COALESCE(is_admin, FALSE), created_at, avatar_url,
		       COALESCE(is_department_rep, FALSE), department_id
		FROM users WHERE id = $1`, userID).Scan(
		&email, &displayName, &isMod, &isAdmin, &createdAt, &avatarURL, &isDeptRep, &deptID)
	if err != nil {
		return nil, err
	}
	out := scanUserPublicFields(userID, email, displayName, isMod, isAdmin, createdAt, avatarURL)
	out["is_department_rep"] = isDeptRep
	if deptID.Valid {
		out["department_id"] = int(deptID.Int64)
	}
	return out, nil
}

func normalizeDisplayName(raw string) (string, error) {
	s := strings.TrimSpace(raw)
	if s == "" {
		return "", nil
	}
	if len([]rune(s)) < 2 {
		return "", fmt.Errorf("Никнейм — минимум 2 символа")
	}
	if len([]rune(s)) > 32 {
		return "", fmt.Errorf("Никнейм — не длиннее 32 символов")
	}
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') ||
			r == '_' || r == '-' || r == '.' || (r >= 0x0400 && r <= 0x04FF) {
			continue
		}
		return "", fmt.Errorf("Допустимы буквы, цифры, _, -, .")
	}
	return s, nil
}

// PatchMyProfileHandler — никнейм (display_name).
func PatchMyProfileHandler(w http.ResponseWriter, r *http.Request) {
	uid, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	var req struct {
		DisplayName *string `json:"display_name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid JSON")
		return
	}
	if req.DisplayName == nil {
		respondWithError(w, http.StatusBadRequest, "Укажите display_name")
		return
	}
	name, err := normalizeDisplayName(*req.DisplayName)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}
	var stored sql.NullString
	if name != "" {
		stored = sql.NullString{String: name, Valid: true}
	}
	if _, err := database.DB.Exec(`UPDATE users SET display_name = $1 WHERE id = $2`, stored, uid); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}
	user, err := LoadUserPublic(uid)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}
	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"status": "success",
		"user":   user,
	})
}

func scanUserPublicFields(
	id int, email, displayName string, isMod, isAdmin bool, createdAt time.Time, avatarURL sql.NullString,
) map[string]interface{} {
	out := map[string]interface{}{
		"id":            id,
		"email":         email,
		"is_moderator":  isMod,
		"is_admin":      isAdmin,
		"created_at":    createdAt.UTC().Format(time.RFC3339),
	}
	if strings.TrimSpace(displayName) != "" {
		out["display_name"] = strings.TrimSpace(displayName)
	}
	if avatarURL.Valid && strings.TrimSpace(avatarURL.String) != "" {
		out["avatar_url"] = avatarURL.String
	}
	return out
}
