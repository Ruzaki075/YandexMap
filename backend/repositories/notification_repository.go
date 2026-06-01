package repositories

import (
	"backend/database"
	"backend/models"
	"database/sql"
)

type NotificationRepository interface {
	Create(userID int, typ string, markerID *int, title, body string) (int, error)
	ListForUser(userID, limit, offset int) ([]models.Notification, int, error)
	CountUnread(userID int) (int, error)
	MarkRead(id, userID int) error
	MarkAllRead(userID int) error
}

type PostgresNotificationRepository struct{}

func NewNotificationRepository() NotificationRepository {
	return &PostgresNotificationRepository{}
}

func (r *PostgresNotificationRepository) Create(userID int, typ string, markerID *int, title, body string) (int, error) {
	var id int
	var mid interface{}
	if markerID != nil {
		mid = *markerID
	}
	err := database.DB.QueryRow(`
		INSERT INTO notifications (user_id, notif_type, marker_id, title, body)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id`,
		userID, typ, mid, title, nullNotifBody(body),
	).Scan(&id)
	return id, err
}

func nullNotifBody(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}

func (r *PostgresNotificationRepository) ListForUser(userID, limit, offset int) ([]models.Notification, int, error) {
	var total int
	if err := database.DB.QueryRow(`SELECT COUNT(*) FROM notifications WHERE user_id = $1`, userID).Scan(&total); err != nil {
		return nil, 0, err
	}
	if limit <= 0 {
		limit = 30
	}
	if limit > 100 {
		limit = 100
	}
	if offset < 0 {
		offset = 0
	}
	rows, err := database.DB.Query(`
		SELECT id, user_id, notif_type, marker_id, title, body, read_at, created_at
		FROM notifications
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`, userID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	var list []models.Notification
	for rows.Next() {
		var n models.Notification
		var mid sql.NullInt64
		var body sql.NullString
		var readAt sql.NullTime
		if err := rows.Scan(&n.ID, &n.UserID, &n.Type, &mid, &n.Title, &body, &readAt, &n.CreatedAt); err != nil {
			continue
		}
		if mid.Valid {
			v := int(mid.Int64)
			n.MarkerID = &v
		}
		if body.Valid {
			n.Body = body.String
		}
		if readAt.Valid {
			t := readAt.Time
			n.ReadAt = &t
		}
		list = append(list, n)
	}
	return list, total, nil
}

func (r *PostgresNotificationRepository) CountUnread(userID int) (int, error) {
	var n int
	err := database.DB.QueryRow(
		`SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND read_at IS NULL`,
		userID,
	).Scan(&n)
	return n, err
}

func (r *PostgresNotificationRepository) MarkRead(id, userID int) error {
	_, err := database.DB.Exec(
		`UPDATE notifications SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP) WHERE id = $1 AND user_id = $2`,
		id, userID,
	)
	return err
}

func (r *PostgresNotificationRepository) MarkAllRead(userID int) error {
	_, err := database.DB.Exec(
		`UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND read_at IS NULL`,
		userID,
	)
	return err
}
