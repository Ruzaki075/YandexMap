package repositories

import (
	"backend/database"
	"backend/models"
	"database/sql"
	"strings"
)

type ReviewRepository interface {
	Upsert(markerID, userID int, rating int, comment string) (int, error)
	Summary(markerID int) (count int, avg *float64, err error)
	List(markerID int, limit, offset int) ([]models.MarkerReview, int, error)
	GetUserReview(markerID, userID int) (*models.MarkerReview, error)
}

type PostgresReviewRepository struct{}

func NewReviewRepository() ReviewRepository {
	return &PostgresReviewRepository{}
}

func (r *PostgresReviewRepository) Upsert(markerID, userID int, rating int, comment string) (int, error) {
	var id int
	var cmt interface{}
	if strings.TrimSpace(comment) != "" {
		cmt = strings.TrimSpace(comment)
	}
	err := database.DB.QueryRow(`
		INSERT INTO marker_reviews (marker_id, user_id, rating, comment)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (marker_id, user_id) DO UPDATE SET
			rating = EXCLUDED.rating,
			comment = EXCLUDED.comment,
			updated_at = CURRENT_TIMESTAMP
		RETURNING id`,
		markerID, userID, rating, cmt,
	).Scan(&id)
	return id, err
}

func (r *PostgresReviewRepository) Summary(markerID int) (count int, avg *float64, err error) {
	var cnt sql.NullInt64
	var av sql.NullFloat64
	err = database.DB.QueryRow(`
		SELECT COUNT(*)::bigint, AVG(rating)::float8 FROM marker_reviews WHERE marker_id = $1
	`, markerID).Scan(&cnt, &av)
	if err != nil {
		return 0, nil, err
	}
	if !cnt.Valid || cnt.Int64 == 0 {
		return 0, nil, nil
	}
	c := int(cnt.Int64)
	v := av.Float64
	return c, &v, nil
}

func (r *PostgresReviewRepository) List(markerID int, limit, offset int) ([]models.MarkerReview, int, error) {
	var total int
	if err := database.DB.QueryRow(`SELECT COUNT(*) FROM marker_reviews WHERE marker_id = $1`, markerID).Scan(&total); err != nil {
		return nil, 0, err
	}
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	if offset < 0 {
		offset = 0
	}
	rows, err := database.DB.Query(`
		SELECT r.id, r.marker_id, r.user_id, r.rating, r.comment, r.created_at, r.updated_at, COALESCE(u.email, '')
		FROM marker_reviews r
		LEFT JOIN users u ON r.user_id = u.id
		WHERE r.marker_id = $1
		ORDER BY r.created_at DESC
		LIMIT $2 OFFSET $3
	`, markerID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	var list []models.MarkerReview
	for rows.Next() {
		var rev models.MarkerReview
		var cmt sql.NullString
		if err := rows.Scan(&rev.ID, &rev.MarkerID, &rev.UserID, &rev.Rating, &cmt, &rev.CreatedAt, &rev.UpdatedAt, &rev.UserEmail); err != nil {
			continue
		}
		if cmt.Valid {
			rev.Comment = cmt.String
		}
		list = append(list, rev)
	}
	return list, total, nil
}

func (r *PostgresReviewRepository) GetUserReview(markerID, userID int) (*models.MarkerReview, error) {
	var rev models.MarkerReview
	var cmt sql.NullString
	err := database.DB.QueryRow(`
		SELECT r.id, r.marker_id, r.user_id, r.rating, r.comment, r.created_at, r.updated_at, COALESCE(u.email, '')
		FROM marker_reviews r
		LEFT JOIN users u ON r.user_id = u.id
		WHERE r.marker_id = $1 AND r.user_id = $2
	`, markerID, userID).Scan(&rev.ID, &rev.MarkerID, &rev.UserID, &rev.Rating, &cmt, &rev.CreatedAt, &rev.UpdatedAt, &rev.UserEmail)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if cmt.Valid {
		rev.Comment = cmt.String
	}
	return &rev, nil
}
