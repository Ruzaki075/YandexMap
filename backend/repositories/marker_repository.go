package repositories

import (
	"backend/database"
	"backend/models"
	"database/sql"
)

type MarkerRepository interface {
	GetAll() ([]models.Marker, error)
	Create(req models.CreateMarkerRequest) (int, error)
	Delete(id int) error
	GetUserEmail(userID int) (string, error)
	UserExists(id int) bool
}

type PostgresMarkerRepository struct{}

func NewMarkerRepository() MarkerRepository {
	return &PostgresMarkerRepository{}
}

func (r *PostgresMarkerRepository) GetAll() ([]models.Marker, error) {
	rows, err := database.DB.Query(`
		SELECT m.id, m.user_id, m.text, m.latitude, m.longitude,
		       m.image_url, m.domain_key, m.group_key, m.issue_key, m.ai_confidence,
		       m.status, m.created_at, m.updated_at, u.email
		FROM markers m
		LEFT JOIN users u ON m.user_id = u.id
		ORDER BY m.created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var markers []models.Marker
	for rows.Next() {
		var m models.Marker
		var img, email, dkey, gkey, ikey sql.NullString
		var ai sql.NullFloat64

		if err := rows.Scan(&m.ID, &m.UserID, &m.Text, &m.Latitude, &m.Longitude,
			&img, &dkey, &gkey, &ikey, &ai, &m.Status, &m.CreatedAt, &m.UpdatedAt, &email); err != nil {
			continue
		}
		if img.Valid {
			m.ImageURL = img.String
		}
		if dkey.Valid {
			m.DomainKey = dkey.String
		}
		if gkey.Valid {
			m.GroupKey = gkey.String
		}
		if ikey.Valid {
			m.IssueKey = ikey.String
		}
		if ai.Valid {
			v := ai.Float64
			m.AIConfidence = &v
		}
		if email.Valid {
			m.UserEmail = email.String
		}
		markers = append(markers, m)
	}
	return markers, nil
}

func (r *PostgresMarkerRepository) Create(req models.CreateMarkerRequest) (int, error) {
	var id int
	var dkey, gkey, ikey sql.NullString
	var ai sql.NullFloat64
	if req.DomainKey != "" {
		dkey = sql.NullString{String: req.DomainKey, Valid: true}
	}
	if req.GroupKey != "" {
		gkey = sql.NullString{String: req.GroupKey, Valid: true}
	}
	if req.IssueKey != "" {
		ikey = sql.NullString{String: req.IssueKey, Valid: true}
	}
	if req.AIConfidence != nil {
		ai = sql.NullFloat64{Float64: *req.AIConfidence, Valid: true}
	}
	err := database.DB.QueryRow(`
		INSERT INTO markers (user_id,text,latitude,longitude,image_url,domain_key,group_key,issue_key,ai_confidence,status)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending') RETURNING id`,
		req.UserID, req.Text, req.Latitude, req.Longitude, req.ImageURL,
		dkey, gkey, ikey, ai,
	).Scan(&id)
	return id, err
}

func (r *PostgresMarkerRepository) Delete(id int) error {
	_, err := database.DB.Exec("DELETE FROM markers WHERE id=$1", id)
	return err
}

func (r *PostgresMarkerRepository) GetUserEmail(userID int) (string, error) {
	var email string
	err := database.DB.QueryRow("SELECT email FROM users WHERE id=$1", userID).Scan(&email)
	return email, err
}

func (r *PostgresMarkerRepository) UserExists(id int) bool {
	var exists bool
	database.DB.QueryRow("SELECT EXISTS(SELECT 1 FROM users WHERE id=$1)", id).Scan(&exists)
	return exists
}
