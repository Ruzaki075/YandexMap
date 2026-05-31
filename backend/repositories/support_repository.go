package repositories

import (
	"backend/database"
	"backend/models"
	"backend/utils"
	"errors"
	"fmt"
)

type SupportRepository struct{}

func NewSupportRepository() *SupportRepository {
	return &SupportRepository{}
}

func (r *SupportRepository) Count(markerID int) (int, error) {
	var n int
	err := database.DB.QueryRow(
		`SELECT COUNT(*)::int FROM marker_supports WHERE marker_id = $1`, markerID,
	).Scan(&n)
	return n, err
}

func (r *SupportRepository) UserSupported(markerID, userID int) (bool, error) {
	var exists bool
	err := database.DB.QueryRow(
		`SELECT EXISTS(SELECT 1 FROM marker_supports WHERE marker_id = $1 AND user_id = $2)`,
		markerID, userID,
	).Scan(&exists)
	return exists, err
}

func (r *SupportRepository) Add(markerID, userID int) (bool, error) {
	res, err := database.DB.Exec(
		`INSERT INTO marker_supports (marker_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
		markerID, userID,
	)
	if err != nil {
		return false, err
	}
	n, _ := res.RowsAffected()
	if n > 0 {
		_, _ = database.DB.Exec(
			`UPDATE users SET karma_points = karma_points + 2 WHERE id = $1`, userID,
		)
		ownerID, _ := NewMarkerRepository().GetMarkerOwnerUserID(markerID)
		if ownerID > 0 && ownerID != userID {
			_, _ = database.DB.Exec(
				`UPDATE users SET karma_points = karma_points + 1 WHERE id = $1`, ownerID,
			)
		}
	}
	return n > 0, nil
}

func (r *SupportRepository) Remove(markerID, userID int) error {
	_, err := database.DB.Exec(
		`DELETE FROM marker_supports WHERE marker_id = $1 AND user_id = $2`,
		markerID, userID,
	)
	return err
}

func (r *SupportRepository) List(markerID int) ([]models.MarkerSupport, error) {
	rows, err := database.DB.Query(`
		SELECT s.id, s.marker_id, s.user_id, s.created_at, COALESCE(u.email, '')
		FROM marker_supports s
		LEFT JOIN users u ON u.id = s.user_id
		WHERE s.marker_id = $1
		ORDER BY s.created_at ASC
	`, markerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []models.MarkerSupport
	for rows.Next() {
		var s models.MarkerSupport
		if err := rows.Scan(&s.ID, &s.MarkerID, &s.UserID, &s.CreatedAt, &s.UserEmail); err != nil {
			continue
		}
		list = append(list, s)
	}
	return list, nil
}

func (r *SupportRepository) FindNearby(lat, lng float64, radiusM int, limit int) ([]models.NearbyMarker, error) {
	if limit <= 0 || limit > 20 {
		limit = 10
	}
	// Грубый bbox для индекса, точное расстояние — Haversine
	delta := float64(radiusM) / 111000
	rows, err := database.DB.Query(`
		SELECT m.id, m.text, COALESCE(m.domain_key, ''), COALESCE(m.status, 'pending'),
		       m.latitude, m.longitude,
		       (SELECT COUNT(*)::int FROM marker_supports s WHERE s.marker_id = m.id)
		FROM markers m
		WHERE LOWER(COALESCE(NULLIF(TRIM(m.status), ''), 'pending')) IN ('approved', 'in_progress', 'pending')
		  AND m.latitude BETWEEN $1 AND $2
		  AND m.longitude BETWEEN $3 AND $4
	`, lat-delta, lat+delta, lng-delta, lng+delta)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.NearbyMarker
	for rows.Next() {
		var n models.NearbyMarker
		if err := rows.Scan(&n.ID, &n.Text, &n.DomainKey, &n.Status, &n.Latitude, &n.Longitude, &n.SupportCount); err != nil {
			continue
		}
		n.DistanceM = utils.HaversineMeters(lat, lng, n.Latitude, n.Longitude)
		if n.DistanceM <= float64(radiusM) {
			out = append(out, n)
		}
	}
	// sort by distance
	for i := 0; i < len(out); i++ {
		for j := i + 1; j < len(out); j++ {
			if out[j].DistanceM < out[i].DistanceM {
				out[i], out[j] = out[j], out[i]
			}
		}
	}
	if len(out) > limit {
		out = out[:limit]
	}
	return out, nil
}

func AddKarma(userID, points int) {
	if userID <= 0 || points == 0 {
		return
	}
	_, _ = database.DB.Exec(
		`UPDATE users SET karma_points = GREATEST(0, karma_points + $1) WHERE id = $2`,
		points, userID,
	)
}

func GetLeaderboard(limit int) ([]map[string]interface{}, error) {
	if limit <= 0 || limit > 50 {
		limit = 20
	}
	rows, err := database.DB.Query(fmt.Sprintf(`
		SELECT id, email, COALESCE(NULLIF(TRIM(display_name), ''), '') AS display_name,
		       karma_points, COALESCE(avatar_url, '') FROM users
		WHERE karma_points > 0
		ORDER BY karma_points DESC, id ASC
		LIMIT %d
	`, limit))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []map[string]interface{}
	rank := 1
	for rows.Next() {
		var id, karma int
		var email, displayName, avatar string
		if err := rows.Scan(&id, &email, &displayName, &karma, &avatar); err != nil {
			continue
		}
		row := map[string]interface{}{
			"rank": rank, "user_id": id, "email": email, "karma_points": karma,
		}
		if displayName != "" {
			row["display_name"] = displayName
		}
		if avatar != "" {
			row["avatar_url"] = avatar
		}
		list = append(list, row)
		rank++
	}
	return list, nil
}

var ErrAlreadySupported = errors.New("already supported")
