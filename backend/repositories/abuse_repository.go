package repositories

import (
	"database/sql"
	"fmt"
	"strings"

	"backend/database"
	"backend/models"
)

func CreateAbuseReport(reporterID int, targetType string, targetID int, reason, details string) (int, error) {
	var dup int
	_ = database.DB.QueryRow(`
		SELECT 1 FROM abuse_reports
		WHERE reporter_user_id = $1 AND target_type = $2 AND target_id = $3 AND status = 'open'
		LIMIT 1`,
		reporterID, targetType, targetID,
	).Scan(&dup)
	if dup == 1 {
		return 0, fmt.Errorf("duplicate open report")
	}

	var id int
	err := database.DB.QueryRow(`
		INSERT INTO abuse_reports (reporter_user_id, target_type, target_id, reason, details)
		VALUES ($1, $2, $3, $4, $5) RETURNING id`,
		reporterID, targetType, targetID, reason, details,
	).Scan(&id)
	if err != nil {
		return 0, err
	}
	NotifyModeratorsOnAbuseReport(id, targetType, targetID, reason)
	return id, nil
}

// NotifyModeratorsOnAbuseReport — уведомление модераторам о новой жалобе.
func NotifyModeratorsOnAbuseReport(reportID int, targetType string, targetID int, reason string) {
	rows, err := database.DB.Query(
		`SELECT id FROM users WHERE COALESCE(is_moderator, FALSE) OR COALESCE(is_admin, FALSE)`,
	)
	if err != nil {
		return
	}
	defer rows.Close()
	notif := NewNotificationRepository()
	var markerID *int
	if targetType == "marker" && targetID > 0 {
		markerID = &targetID
	}
	title := "Новая жалоба"
	body := reason
	if targetType == "marker" && targetID > 0 {
		var snippet string
		_ = database.DB.QueryRow(
			`SELECT LEFT(COALESCE(NULLIF(TRIM(text), ''), 'обращение'), 80) FROM markers WHERE id = $1`,
			targetID,
		).Scan(&snippet)
		if snippet != "" {
			body = reason + ": " + snippet
		}
	}
	if body == "" {
		body = "новая жалоба"
	}
	for rows.Next() {
		var uid int
		if err := rows.Scan(&uid); err != nil {
			continue
		}
		_, _ = notif.Create(uid, "abuse_report", markerID, title, body)
	}
}

type AbuseListQuery struct {
	Page     int
	PageSize int
	Status   string
	Reason   string
}

func ListAbuseReports(q AbuseListQuery) ([]models.AbuseReportModeration, int, error) {
	if q.Page < 1 {
		q.Page = 1
	}
	if q.PageSize < 1 || q.PageSize > 100 {
		q.PageSize = 40
	}
	offset := (q.Page - 1) * q.PageSize

	where := []string{"1=1"}
	args := []interface{}{}
	n := 1

	st := strings.TrimSpace(q.Status)
	if st != "" && st != "all" {
		where = append(where, fmt.Sprintf("ar.status = $%d", n))
		args = append(args, st)
		n++
	}
	if r := strings.TrimSpace(q.Reason); r != "" {
		where = append(where, fmt.Sprintf("ar.reason = $%d", n))
		args = append(args, r)
		n++
	}

	whereSQL := strings.Join(where, " AND ")

	var total int
	countQ := `SELECT COUNT(*) FROM abuse_reports ar WHERE ` + whereSQL
	if err := database.DB.QueryRow(countQ, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	listArgs := append(args, q.PageSize, offset)
	query := fmt.Sprintf(`
		SELECT ar.id, ar.reporter_user_id, COALESCE(u.email, ''),
			ar.target_type, ar.target_id, ar.reason, COALESCE(ar.details, ''),
			ar.status, ar.created_at,
			COALESCE(m.text, ''), COALESCE(m.status, ''), COALESCE(m.domain_key, ''),
			COALESCE(m.image_url, ''),
			m.latitude, m.longitude,
			(SELECT COUNT(*)::int FROM abuse_reports ar2
			 WHERE ar2.target_type = ar.target_type AND ar2.target_id = ar.target_id
			   AND ar2.status = 'open')
		FROM abuse_reports ar
		JOIN users u ON u.id = ar.reporter_user_id
		LEFT JOIN markers m ON ar.target_type = 'marker' AND m.id = ar.target_id
		WHERE %s
		ORDER BY ar.created_at DESC
		LIMIT $%d OFFSET $%d`, whereSQL, n, n+1)

	rows, err := database.DB.Query(query, listArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var list []models.AbuseReportModeration
	for rows.Next() {
		var item models.AbuseReportModeration
		var lat, lng sql.NullFloat64
		if err := rows.Scan(
			&item.ID, &item.ReporterUserID, &item.ReporterEmail,
			&item.TargetType, &item.TargetID, &item.Reason, &item.Details,
			&item.Status, &item.CreatedAt,
			&item.MarkerText, &item.MarkerStatus, &item.MarkerDomainKey,
			&item.MarkerImageURL, &lat, &lng,
			&item.OpenReportsOnTarget,
		); err != nil {
			return nil, 0, err
		}
		if lat.Valid {
			v := lat.Float64
			item.MarkerLatitude = &v
		}
		if lng.Valid {
			v := lng.Float64
			item.MarkerLongitude = &v
		}
		list = append(list, item)
	}
	return list, total, rows.Err()
}

func AbuseReportStats() (map[string]int, error) {
	rows, err := database.DB.Query(`
		SELECT status, COUNT(*)::int FROM abuse_reports GROUP BY status`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]int{}
	for rows.Next() {
		var st string
		var c int
		if err := rows.Scan(&st, &c); err != nil {
			return nil, err
		}
		out[st] = c
	}
	return out, rows.Err()
}

func UpdateAbuseReportStatus(id int, status string) error {
	status = strings.TrimSpace(status)
	if status != "dismissed" && status != "actioned" {
		return fmt.Errorf("invalid status")
	}
	var targetType string
	var targetID int
	err := database.DB.QueryRow(
		`SELECT target_type, target_id FROM abuse_reports WHERE id = $1`,
		id,
	).Scan(&targetType, &targetID)
	if err == sql.ErrNoRows {
		return sql.ErrNoRows
	}
	if err != nil {
		return err
	}

	res, err := database.DB.Exec(
		`UPDATE abuse_reports SET status = $1 WHERE id = $2`,
		status, id,
	)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}

	// «Обработано» / отклонение метки — закрываем все открытые жалобы на то же обращение
	if status == "actioned" && targetID > 0 && strings.TrimSpace(targetType) != "" {
		_, _ = database.DB.Exec(
			`UPDATE abuse_reports SET status = 'actioned'
			 WHERE target_type = $1 AND target_id = $2 AND status = 'open'`,
			targetType, targetID,
		)
	}
	return nil
}

func GetAbuseReportByID(id int) (*models.AbuseReportModeration, error) {
	var item models.AbuseReportModeration
	var lat, lng sql.NullFloat64
	err := database.DB.QueryRow(`
		SELECT ar.id, ar.reporter_user_id, COALESCE(u.email, ''),
			ar.target_type, ar.target_id, ar.reason, COALESCE(ar.details, ''),
			ar.status, ar.created_at,
			COALESCE(m.text, ''), COALESCE(m.status, ''), COALESCE(m.domain_key, ''),
			COALESCE(m.image_url, ''),
			m.latitude, m.longitude
		FROM abuse_reports ar
		JOIN users u ON u.id = ar.reporter_user_id
		LEFT JOIN markers m ON ar.target_type = 'marker' AND m.id = ar.target_id
		WHERE ar.id = $1`, id).Scan(
		&item.ID, &item.ReporterUserID, &item.ReporterEmail,
		&item.TargetType, &item.TargetID, &item.Reason, &item.Details,
		&item.Status, &item.CreatedAt,
		&item.MarkerText, &item.MarkerStatus, &item.MarkerDomainKey,
		&item.MarkerImageURL, &lat, &lng,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if lat.Valid {
		v := lat.Float64
		item.MarkerLatitude = &v
	}
	if lng.Valid {
		v := lng.Float64
		item.MarkerLongitude = &v
	}
	return &item, nil
}