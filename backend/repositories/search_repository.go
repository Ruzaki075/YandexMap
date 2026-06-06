package repositories

import (
	"backend/database"
	"backend/models"
	"strings"
)

func SearchMarkers(q string, limit int) ([]models.Marker, error) {
	q = strings.TrimSpace(q)
	if q == "" {
		return []models.Marker{}, nil
	}
	if limit < 1 || limit > 100 {
		limit = 40
	}
	tsq := strings.ReplaceAll(q, "'", " ")
	rows, err := database.DB.Query(markerSelectBase+`
		WHERE m.search_vector @@ plainto_tsquery('russian', $1)
		   OR m.text ILIKE '%' || $2 || '%'
		   OR COALESCE(m.address_text, '') ILIKE '%' || $2 || '%'
		ORDER BY ts_rank(m.search_vector, plainto_tsquery('russian', $1)) DESC
		LIMIT $3`, tsq, q, limit)
	if err != nil {
		rows, err = database.DB.Query(markerSelectBase+`
			WHERE m.text ILIKE '%' || $1 || '%'
			ORDER BY m.created_at DESC LIMIT $2`, q, limit)
		if err != nil {
			return nil, err
		}
	}
	defer rows.Close()
	var list []models.Marker
	for rows.Next() {
		m, err := scanMarkerFromRows(rows)
		if err != nil {
			continue
		}
		list = append(list, m)
	}
	return list, nil
}
