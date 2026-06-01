package repositories

import (
	"backend/database"
	"backend/models"
	"time"
)

type FavoriteMarker struct {
	FavoritedAt time.Time     `json:"favorited_at"`
	Marker      models.Marker `json:"marker"`
}

func AddFavorite(userID, markerID int) error {
	_, err := database.DB.Exec(`
		INSERT INTO marker_favorites (user_id, marker_id) VALUES ($1, $2)
		ON CONFLICT DO NOTHING`, userID, markerID)
	return err
}

func RemoveFavorite(userID, markerID int) error {
	_, err := database.DB.Exec(`
		DELETE FROM marker_favorites WHERE user_id = $1 AND marker_id = $2`,
		userID, markerID)
	return err
}

func IsFavorite(userID, markerID int) (bool, error) {
	var n int
	err := database.DB.QueryRow(`
		SELECT COUNT(*) FROM marker_favorites WHERE user_id = $1 AND marker_id = $2`,
		userID, markerID).Scan(&n)
	return n > 0, err
}

func ListFavorites(userID, limit int) ([]FavoriteMarker, error) {
	if limit < 1 || limit > 100 {
		limit = 50
	}
	rows, err := database.DB.Query(`
		SELECT f.created_at, m.id
		FROM marker_favorites f
		JOIN markers m ON m.id = f.marker_id
		WHERE f.user_id = $1
		ORDER BY f.created_at DESC
		LIMIT $2`, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	repo := NewMarkerRepository()
	var list []FavoriteMarker
	for rows.Next() {
		var favAt time.Time
		var mid int
		if err := rows.Scan(&favAt, &mid); err != nil {
			continue
		}
		m, err := repo.GetByID(mid)
		if err != nil {
			continue
		}
		list = append(list, FavoriteMarker{FavoritedAt: favAt, Marker: *m})
	}
	return list, nil
}
