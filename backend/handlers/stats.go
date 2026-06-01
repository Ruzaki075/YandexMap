package handlers

import (
	"net/http"

	"backend/database"
)

func PublicMapStatsHandler(w http.ResponseWriter, r *http.Request) {
	var active, resolved, total int
	err := database.DB.QueryRow(`
		SELECT
			COUNT(*) FILTER (WHERE LOWER(COALESCE(NULLIF(TRIM(status), ''), 'pending')) IN ('approved', 'in_progress'))::int,
			COUNT(*) FILTER (WHERE LOWER(COALESCE(NULLIF(TRIM(status), ''), 'pending')) = 'resolved')::int,
			COUNT(*)::int
		FROM markers
		WHERE LOWER(COALESCE(NULLIF(TRIM(status), ''), 'pending')) IN ('approved', 'in_progress', 'resolved')
	`).Scan(&active, &resolved, &total)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}
	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"active":   active,
		"resolved": resolved,
		"total":    total,
	})
}
