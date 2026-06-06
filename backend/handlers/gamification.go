package handlers

import (
	"database/sql"
	"net/http"
	"strconv"

	"backend/database"
	"backend/middleware"
	"backend/services"

	"github.com/gorilla/mux"
)

func ProfilePointsHandler(w http.ResponseWriter, r *http.Request) {
	uid, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	summary, err := services.GetUserPointsSummary(uid)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 {
		limit = 30
	}
	rows, err := database.DB.Query(`
		SELECT id, action, points, COALESCE(description,''), marker_id, created_at
		FROM points_log WHERE user_id = $1
		ORDER BY created_at DESC LIMIT $2`, uid, limit)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}
	defer rows.Close()
	var history []map[string]interface{}
	for rows.Next() {
		var id, pts int
		var action, desc string
		var mid *int
		var created string
		var midNull sql.NullInt64
		if err := rows.Scan(&id, &action, &pts, &desc, &midNull, &created); err != nil {
			continue
		}
		if midNull.Valid {
			v := int(midNull.Int64)
			mid = &v
		}
		history = append(history, map[string]interface{}{
			"id": id, "action": action, "points": pts,
			"description": desc, "marker_id": mid, "created_at": created,
		})
	}
	summary["history"] = history
	respondWithJSON(w, http.StatusOK, summary)
}

func ProfileAchievementsHandler(w http.ResponseWriter, r *http.Request) {
	uid, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	list, err := listUserAchievements(uid)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}
	respondWithJSON(w, http.StatusOK, map[string]interface{}{"achievements": list})
}

func UserAchievementsHandler(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil || id <= 0 {
		respondWithError(w, http.StatusBadRequest, "Invalid user id")
		return
	}
	list, err := listUserAchievements(id)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}
	respondWithJSON(w, http.StatusOK, map[string]interface{}{"achievements": list})
}

func listUserAchievements(userID int) ([]map[string]interface{}, error) {
	rows, err := database.DB.Query(`
		SELECT a.id, a.key, a.name_ru, a.description_ru, a.icon, a.points_reward,
		       a.condition_type, a.condition_value,
		       (ua.earned_at IS NOT NULL) AS earned,
		       ua.earned_at
		FROM achievements a
		LEFT JOIN user_achievements ua ON ua.achievement_id = a.id AND ua.user_id = $1
		ORDER BY a.id`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []map[string]interface{}
	for rows.Next() {
		var id, reward, need int
		var key, name, desc, icon, condType string
		var earned bool
		var earnedAt *string
		if err := rows.Scan(&id, &key, &name, &desc, &icon, &reward, &condType, &need, &earned, &earnedAt); err != nil {
			continue
		}
		list = append(list, map[string]interface{}{
			"id": id, "key": key, "name_ru": name, "description_ru": desc,
			"icon": icon, "points_reward": reward,
			"condition_type": condType, "condition_value": need,
			"earned": earned, "earned_at": earnedAt,
		})
	}
	return list, nil
}
