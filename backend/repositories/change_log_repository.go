package repositories

import (
	"backend/database"
	"database/sql"
	"time"
)

type TimelineEntry struct {
	ID          int       `json:"id"`
	Kind        string    `json:"kind"`
	FieldName   string    `json:"field_name,omitempty"`
	OldValue    string    `json:"old_value,omitempty"`
	NewValue    string    `json:"new_value,omitempty"`
	OldStatus   string    `json:"old_status,omitempty"`
	NewStatus   string    `json:"new_status,omitempty"`
	ActorUserID *int      `json:"actor_user_id,omitempty"`
	ActorEmail  string    `json:"actor_email,omitempty"`
	Note        string    `json:"note,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}

func InsertMarkerChange(markerID int, field, oldVal, newVal string, actorID *int) error {
	var actor sql.NullInt64
	if actorID != nil && *actorID > 0 {
		actor = sql.NullInt64{Int64: int64(*actorID), Valid: true}
	}
	_, err := database.DB.Exec(`
		INSERT INTO marker_change_log (marker_id, field_name, old_value, new_value, actor_user_id)
		VALUES ($1, $2, $3, $4, $5)`,
		markerID, field, nullStr(oldVal), nullStr(newVal), actor,
	)
	return err
}

func ListMarkerTimeline(markerID int, limit int) ([]TimelineEntry, error) {
	if limit < 1 || limit > 200 {
		limit = 100
	}
	rows, err := database.DB.Query(`
		SELECT id, 'status' AS kind, '' AS field_name,
		       COALESCE(old_status, ''), new_status,
		       '', '', actor_user_id, COALESCE(u.email, ''),
		       COALESCE(moderator_note, ''), created_at
		FROM marker_status_log l
		LEFT JOIN users u ON l.actor_user_id = u.id
		WHERE marker_id = $1
		UNION ALL
		SELECT c.id, 'change' AS kind, field_name,
		       '', '', COALESCE(old_value, ''), COALESCE(new_value, ''),
		       actor_user_id, COALESCE(u.email, ''), '', c.created_at
		FROM marker_change_log c
		LEFT JOIN users u ON c.actor_user_id = u.id
		WHERE c.marker_id = $1
		ORDER BY created_at DESC
		LIMIT $2`, markerID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []TimelineEntry
	for rows.Next() {
		var e TimelineEntry
		var actorID sql.NullInt64
		if err := rows.Scan(
			&e.ID, &e.Kind, &e.FieldName,
			&e.OldStatus, &e.NewStatus,
			&e.OldValue, &e.NewValue,
			&actorID, &e.ActorEmail, &e.Note, &e.CreatedAt,
		); err != nil {
			continue
		}
		if actorID.Valid {
			v := int(actorID.Int64)
			e.ActorUserID = &v
		}
		list = append(list, e)
	}
	return list, nil
}

func nullStr(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}
