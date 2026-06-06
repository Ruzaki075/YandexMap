package repositories

import (
	"backend/database"
	"database/sql"
	"time"
)

type MarkerStatusLogEntry struct {
	ID            int       `json:"id"`
	MarkerID      int       `json:"marker_id"`
	OldStatus     string    `json:"old_status,omitempty"`
	NewStatus     string    `json:"new_status"`
	ActorUserID   *int      `json:"actor_user_id,omitempty"`
	ActorEmail    string    `json:"actor_email,omitempty"`
	ModeratorNote string    `json:"moderator_note,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
}

func InsertMarkerStatusLog(markerID int, oldStatus, newStatus string, actorUserID *int, note *string) error {
	var noteVal sql.NullString
	if note != nil && *note != "" {
		noteVal = sql.NullString{String: *note, Valid: true}
	}
	var actor sql.NullInt64
	if actorUserID != nil && *actorUserID > 0 {
		actor = sql.NullInt64{Int64: int64(*actorUserID), Valid: true}
	}
	_, err := database.DB.Exec(`
		INSERT INTO marker_status_log (marker_id, old_status, new_status, actor_user_id, moderator_note)
		VALUES ($1, $2, $3, $4, $5)`,
		markerID, nullIfEmpty(oldStatus), newStatus, actor, noteVal,
	)
	return err
}

func ListMarkerStatusLog(markerID int, limit int) ([]MarkerStatusLogEntry, error) {
	if limit < 1 || limit > 100 {
		limit = 50
	}
	rows, err := database.DB.Query(`
		SELECT l.id, l.marker_id, COALESCE(l.old_status, ''), l.new_status,
		       l.actor_user_id, COALESCE(u.email, ''), COALESCE(l.moderator_note, ''), l.created_at
		FROM marker_status_log l
		LEFT JOIN users u ON l.actor_user_id = u.id
		WHERE l.marker_id = $1
		ORDER BY l.created_at DESC
		LIMIT $2`, markerID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []MarkerStatusLogEntry
	for rows.Next() {
		var e MarkerStatusLogEntry
		var oldSt, actorEmail, modNote string
		var actorID sql.NullInt64
		if err := rows.Scan(&e.ID, &e.MarkerID, &oldSt, &e.NewStatus, &actorID, &actorEmail, &modNote, &e.CreatedAt); err != nil {
			continue
		}
		e.OldStatus = oldSt
		e.ActorEmail = actorEmail
		e.ModeratorNote = modNote
		if actorID.Valid {
			v := int(actorID.Int64)
			e.ActorUserID = &v
		}
		list = append(list, e)
	}
	return list, nil
}

func nullIfEmpty(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}
