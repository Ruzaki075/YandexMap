package repositories

import (
	"backend/database"
	"encoding/json"
	"time"
)

type AuditEntry struct {
	ID          int                    `json:"id"`
	ActorUserID *int                   `json:"actor_user_id,omitempty"`
	ActorEmail  string                 `json:"actor_email,omitempty"`
	Action      string                 `json:"action"`
	TargetType  string                 `json:"target_type"`
	TargetID    *int                   `json:"target_id,omitempty"`
	Details     map[string]interface{} `json:"details"`
	CreatedAt   time.Time              `json:"created_at"`
}

func InsertAuditLog(actorID *int, action, targetType string, targetID *int, details map[string]interface{}) {
	if details == nil {
		details = map[string]interface{}{}
	}
	b, _ := json.Marshal(details)
	var actor interface{}
	if actorID != nil && *actorID > 0 {
		actor = *actorID
	}
	_, _ = database.DB.Exec(`
		INSERT INTO admin_audit_log (actor_user_id, action, target_type, target_id, details)
		VALUES ($1, $2, $3, $4, $5)`,
		actor, action, targetType, targetID, b,
	)
}

func ListAuditLog(limit, offset int) ([]AuditEntry, error) {
	if limit < 1 || limit > 200 {
		limit = 50
	}
	rows, err := database.DB.Query(`
		SELECT a.id, a.actor_user_id, COALESCE(u.email, ''), a.action,
		       a.target_type, a.target_id, a.details, a.created_at
		FROM admin_audit_log a
		LEFT JOIN users u ON a.actor_user_id = u.id
		ORDER BY a.created_at DESC
		LIMIT $1 OFFSET $2`, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []AuditEntry
	for rows.Next() {
		var e AuditEntry
		var actorID interface{}
		var targetID interface{}
		var detailsRaw []byte
		if err := rows.Scan(&e.ID, &actorID, &e.ActorEmail, &e.Action,
			&e.TargetType, &targetID, &detailsRaw, &e.CreatedAt); err != nil {
			continue
		}
		if id, ok := actorID.(int64); ok {
			v := int(id)
			e.ActorUserID = &v
		}
		if tid, ok := targetID.(int64); ok {
			v := int(tid)
			e.TargetID = &v
		}
		_ = json.Unmarshal(detailsRaw, &e.Details)
		if e.Details == nil {
			e.Details = map[string]interface{}{}
		}
		list = append(list, e)
	}
	return list, nil
}
