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
		       m.image_url, m.status, m.created_at, m.updated_at, u.email
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
		var img, email sql.NullString

		if err := rows.Scan(&m.ID, &m.UserID, &m.Text, &m.Latitude, &m.Longitude,
			&img, &m.Status, &m.CreatedAt, &m.UpdatedAt, &email); err != nil {
			continue
		}
		if img.Valid {
			m.ImageURL = img.String
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
	err := database.DB.QueryRow(`
		INSERT INTO markers (user_id,text,latitude,longitude,image_url,status)
		VALUES ($1,$2,$3,$4,$5,'pending') RETURNING id`,
		req.UserID, req.Text, req.Latitude, req.Longitude, req.ImageURL,
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
