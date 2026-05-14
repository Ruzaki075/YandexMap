package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"backend/database"
	"backend/middleware"
	"github.com/gorilla/mux"
)

type adminUserRow struct {
	ID           int       `json:"id"`
	Email        string    `json:"email"`
	IsModerator  bool      `json:"is_moderator"`
	IsAdmin      bool      `json:"is_admin"`
	CreatedAt    time.Time `json:"created_at"`
	MarkersCount int       `json:"markers_count"`
}

// AdminListUsersHandler — список пользователей (только администратор).
func AdminListUsersHandler(w http.ResponseWriter, r *http.Request) {
	if !middleware.GetIsAdminFromContext(r.Context()) {
		respondWithError(w, http.StatusForbidden, "Admin only")
		return
	}
	rows, err := database.DB.Query(`
		SELECT u.id, u.email, COALESCE(u.is_moderator, FALSE), COALESCE(u.is_admin, FALSE), u.created_at,
		       (SELECT COUNT(*) FROM markers m WHERE m.user_id = u.id)
		FROM users u
		ORDER BY u.id ASC
	`)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}
	defer rows.Close()

	var list []adminUserRow
	for rows.Next() {
		var u adminUserRow
		if err := rows.Scan(&u.ID, &u.Email, &u.IsModerator, &u.IsAdmin, &u.CreatedAt, &u.MarkersCount); err != nil {
			continue
		}
		list = append(list, u)
	}
	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"status": "success",
		"users":  list,
		"count":  len(list),
	})
}

// AdminPatchUserHandler — смена ролей пользователя (только администратор).
func AdminPatchUserHandler(w http.ResponseWriter, r *http.Request) {
	actorID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	if !middleware.GetIsAdminFromContext(r.Context()) {
		respondWithError(w, http.StatusForbidden, "Admin only")
		return
	}
	targetID, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil || targetID <= 0 {
		respondWithError(w, http.StatusBadRequest, "Invalid user id")
		return
	}
	var body struct {
		IsModerator *bool `json:"is_moderator"`
		IsAdmin     *bool `json:"is_admin"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid JSON")
		return
	}
	if body.IsModerator == nil && body.IsAdmin == nil {
		respondWithError(w, http.StatusBadRequest, "Nothing to update")
		return
	}

	if body.IsAdmin != nil && !*body.IsAdmin && targetID == actorID {
		respondWithError(w, http.StatusBadRequest, "Нельзя снять с себя права администратора")
		return
	}

	var curMod, curAdm bool
	err = database.DB.QueryRow(
		`SELECT COALESCE(is_moderator, FALSE), COALESCE(is_admin, FALSE) FROM users WHERE id = $1`,
		targetID,
	).Scan(&curMod, &curAdm)
	if err == sql.ErrNoRows {
		respondWithError(w, http.StatusNotFound, "User not found")
		return
	}
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}

	newMod := curMod
	newAdm := curAdm
	if body.IsModerator != nil {
		newMod = *body.IsModerator
	}
	if body.IsAdmin != nil {
		newAdm = *body.IsAdmin
	}

	if _, err := database.DB.Exec(
		`UPDATE users SET is_moderator = $1, is_admin = $2 WHERE id = $3`,
		newMod, newAdm, targetID,
	); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"status":        "success",
		"id":            targetID,
		"is_moderator":  newMod,
		"is_admin":      newAdm,
		"updated_at":    time.Now().UTC().Format(time.RFC3339),
	})
}
