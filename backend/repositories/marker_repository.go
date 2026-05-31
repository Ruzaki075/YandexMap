package repositories

import (
	"backend/database"
	"backend/models"
	"database/sql"
	"fmt"
	"strings"
	"time"
)

type MarkerRepository interface {
	GetPublicMarkers(layer string) ([]models.Marker, error)
	ListByUserID(userID int) ([]models.Marker, error)
	ListFiltered(domainKey, status string, overdueOnly bool, page, pageSize int) ([]models.Marker, int, error)
	UpdateText(id, userID int, text string) error
	UpdateMarkerMeta(id, userID int, imageAfterURL, addressText string) error
	ModerationDashboard() (*models.ModerationDashboard, error)
	GetMarkerNotifyMeta(markerID int) (ownerID int, status string, text string, err error)
	GetByID(id int) (*models.Marker, error)
	GetPublicMarkersInBounds(swLat, swLng, neLat, neLng float64, layer string) ([]models.Marker, error)
	Create(req models.CreateMarkerRequest) (int, error)
	Delete(id int) error
	UpdateStatus(id int, status string, moderatorNote *string) error
	GetUserEmail(userID int) (string, error)
	UserExists(id int) bool
	GetMarkerOwnerUserID(markerID int) (int, error)
}

type PostgresMarkerRepository struct{}

func NewMarkerRepository() MarkerRepository {
	return &PostgresMarkerRepository{}
}

const markerSelectBase = `
		SELECT m.id, m.user_id, m.text, m.latitude, m.longitude,
		       m.image_url, COALESCE(m.image_after_url, ''), COALESCE(m.address_text, ''),
		       m.domain_key, m.group_key, m.issue_key, m.ai_confidence,
		       m.status, m.moderator_note, m.response_due_at, m.resolution_due_at, m.resolved_at,
		       m.created_at, m.updated_at,
		       COALESCE(NULLIF(TRIM(u.display_name), ''), u.email) AS user_email,
		       (SELECT COUNT(*)::int FROM marker_reviews r WHERE r.marker_id = m.id),
		       (SELECT AVG(r.rating)::float8 FROM marker_reviews r WHERE r.marker_id = m.id),
		       (SELECT COUNT(*)::int FROM marker_supports s WHERE s.marker_id = m.id)
		FROM markers m
		LEFT JOIN users u ON m.user_id = u.id`

func scanMarkerFromRows(rows *sql.Rows) (models.Marker, error) {
	var m models.Marker
	var img, imgAfter, addr, email, dkey, gkey, ikey, modNote sql.NullString
	var ai sql.NullFloat64
	var reviewCnt sql.NullInt64
	var reviewAvg sql.NullFloat64
	var supportCnt sql.NullInt64
	var respDue, resDue, resolvedAt sql.NullTime

	if err := rows.Scan(&m.ID, &m.UserID, &m.Text, &m.Latitude, &m.Longitude,
		&img, &imgAfter, &addr, &dkey, &gkey, &ikey, &ai, &m.Status, &modNote,
		&respDue, &resDue, &resolvedAt,
		&m.CreatedAt, &m.UpdatedAt, &email,
		&reviewCnt, &reviewAvg, &supportCnt); err != nil {
		return m, err
	}
	if respDue.Valid {
		t := respDue.Time
		m.ResponseDueAt = &t
	}
	if resDue.Valid {
		t := resDue.Time
		m.ResolutionDueAt = &t
	}
	if resolvedAt.Valid {
		t := resolvedAt.Time
		m.ResolvedAt = &t
	}
	if img.Valid {
		m.ImageURL = img.String
	}
	if imgAfter.Valid {
		m.ImageAfterURL = imgAfter.String
	}
	if addr.Valid {
		m.AddressText = addr.String
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
	if modNote.Valid {
		m.ModeratorNote = modNote.String
	}
	if email.Valid {
		m.UserEmail = email.String
	}
	if reviewCnt.Valid {
		m.ReviewCount = int(reviewCnt.Int64)
	}
	if reviewAvg.Valid {
		v := reviewAvg.Float64
		m.ReviewAvg = &v
	}
	if supportCnt.Valid {
		m.SupportCount = int(supportCnt.Int64)
	}
	EnrichMarkerSLA(&m)
	return m, nil
}

func publicMarkersStatusClause(layer string) string {
	switch strings.ToLower(strings.TrimSpace(layer)) {
	case "resolved":
		return `IN ('resolved')`
	case "all":
		return `IN ('approved', 'in_progress', 'resolved')`
	case "active", "":
		return `IN ('approved', 'in_progress')`
	default:
		return `IN ('approved', 'in_progress')`
	}
}

func (r *PostgresMarkerRepository) GetByID(id int) (*models.Marker, error) {
	rows, err := database.DB.Query(markerSelectBase+` WHERE m.id = $1`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	if !rows.Next() {
		return nil, sql.ErrNoRows
	}
	m, err := scanMarkerFromRows(rows)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *PostgresMarkerRepository) GetPublicMarkersInBounds(swLat, swLng, neLat, neLng float64, layer string) ([]models.Marker, error) {
	clause := publicMarkersStatusClause(layer)
	q := markerSelectBase + fmt.Sprintf(`
		WHERE LOWER(COALESCE(NULLIF(TRIM(m.status), ''), 'pending')) %s`, clause)
	args := []interface{}{}
	if database.PostGISAvailable() && swLat != neLat && swLng != neLng {
		q += ` AND m.location IS NOT NULL AND ST_Intersects(
			m.location::geometry,
			ST_MakeEnvelope($1, $2, $3, $4, 4326)
		)`
		args = append(args, swLng, swLat, neLng, neLat)
	} else if swLat != neLat && swLng != neLng {
		q += ` AND m.latitude BETWEEN $1 AND $2 AND m.longitude BETWEEN $3 AND $4`
		args = append(args, swLat, neLat, swLng, neLng)
	}
	q += ` ORDER BY m.created_at DESC LIMIT 2000`
	rows, err := database.DB.Query(q, args...)
	if err != nil {
		return r.GetPublicMarkers(layer)
	}
	defer rows.Close()
	var markers []models.Marker
	for rows.Next() {
		m, err := scanMarkerFromRows(rows)
		if err != nil {
			continue
		}
		markers = append(markers, m)
	}
	return markers, nil
}

func (r *PostgresMarkerRepository) GetPublicMarkers(layer string) ([]models.Marker, error) {
	clause := publicMarkersStatusClause(layer)
	rows, err := database.DB.Query(markerSelectBase + fmt.Sprintf(`
		WHERE LOWER(COALESCE(NULLIF(TRIM(m.status), ''), 'pending')) %s
		ORDER BY m.created_at DESC`, clause))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var markers []models.Marker
	for rows.Next() {
		m, err := scanMarkerFromRows(rows)
		if err != nil {
			continue
		}
		markers = append(markers, m)
	}
	return markers, nil
}

func (r *PostgresMarkerRepository) ListByUserID(userID int) ([]models.Marker, error) {
	rows, err := database.DB.Query(markerSelectBase+`
		WHERE m.user_id = $1
		ORDER BY m.created_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var markers []models.Marker
	for rows.Next() {
		m, err := scanMarkerFromRows(rows)
		if err != nil {
			continue
		}
		markers = append(markers, m)
	}
	return markers, nil
}

func (r *PostgresMarkerRepository) GetMarkerNotifyMeta(markerID int) (ownerID int, status string, text string, err error) {
	var uid sql.NullInt64
	var st, txt sql.NullString
	err = database.DB.QueryRow(`
		SELECT user_id, status, text FROM markers WHERE id = $1`, markerID).Scan(&uid, &st, &txt)
	if err != nil {
		return 0, "", "", err
	}
	if !uid.Valid {
		return 0, "", "", sql.ErrNoRows
	}
	ownerID = int(uid.Int64)
	if st.Valid {
		status = strings.ToLower(strings.TrimSpace(st.String))
	} else {
		status = "pending"
	}
	if status == "" {
		status = "pending"
	}
	if txt.Valid {
		text = txt.String
	}
	return ownerID, status, text, nil
}

func buildMarkerFilterSQL(domainKey, status string, overdueOnly bool) (clause string, args []interface{}) {
	var parts []string
	n := 1
	if domainKey != "" && domainKey != "all" {
		if domainKey == "__none__" {
			parts = append(parts, "(m.domain_key IS NULL OR TRIM(m.domain_key) = '')")
		} else {
			parts = append(parts, fmt.Sprintf("m.domain_key = $%d", n))
			args = append(args, domainKey)
			n++
		}
	}
	if status != "" && status != "all" {
		parts = append(parts, fmt.Sprintf("LOWER(COALESCE(NULLIF(TRIM(m.status), ''), 'pending')) = $%d", n))
		args = append(args, strings.ToLower(strings.TrimSpace(status)))
		n++
	}
	if overdueOnly {
		parts = append(parts, `(
			(LOWER(COALESCE(NULLIF(TRIM(m.status), ''), 'pending')) = 'pending'
			 AND m.response_due_at IS NOT NULL AND m.response_due_at < NOW())
			OR
			(LOWER(COALESCE(NULLIF(TRIM(m.status), ''), 'pending')) IN ('approved', 'in_progress')
			 AND m.resolution_due_at IS NOT NULL AND m.resolution_due_at < NOW())
		)`)
	}
	if len(parts) == 0 {
		return "TRUE", args
	}
	return strings.Join(parts, " AND "), args
}

func (r *PostgresMarkerRepository) ListFiltered(domainKey, status string, overdueOnly bool, page, pageSize int) ([]models.Marker, int, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}
	where, args := buildMarkerFilterSQL(domainKey, status, overdueOnly)

	countSQL := "SELECT COUNT(*) FROM markers m WHERE " + where
	var total int
	if err := database.DB.QueryRow(countSQL, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	limitArg := len(args) + 1
	offsetArg := len(args) + 2
	argsWithPaging := append(append([]interface{}{}, args...), pageSize, offset)

	listSQL := markerSelectBase + " WHERE " + where +
		fmt.Sprintf(` ORDER BY (SELECT COUNT(*) FROM marker_supports s WHERE s.marker_id = m.id) DESC, m.created_at DESC LIMIT $%d OFFSET $%d`, limitArg, offsetArg)

	rows, err := database.DB.Query(listSQL, argsWithPaging...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	var markers []models.Marker
	for rows.Next() {
		m, err := scanMarkerFromRows(rows)
		if err != nil {
			continue
		}
		markers = append(markers, m)
	}
	return markers, total, nil
}

func (r *PostgresMarkerRepository) ModerationDashboard() (*models.ModerationDashboard, error) {
	dash := &models.ModerationDashboard{
		ByStatus:           map[string]int{},
		ByDomain:           map[string]int{},
		ClosureTimeBuckets: []models.NamedCount{},
	}

	if err := database.DB.QueryRow(`SELECT COUNT(*) FROM markers`).Scan(&dash.Total); err != nil {
		return nil, err
	}

	rows, err := database.DB.Query(`
		SELECT LOWER(COALESCE(NULLIF(TRIM(status), ''), 'pending')), COUNT(*)::int
		FROM markers GROUP BY 1
	`)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var st string
		var c int
		if rows.Scan(&st, &c) == nil {
			dash.ByStatus[st] = c
		}
	}
	rows.Close()

	rows2, err := database.DB.Query(`
		SELECT COALESCE(NULLIF(TRIM(domain_key), ''), '__none__'), COUNT(*)::int
		FROM markers GROUP BY 1
	`)
	if err != nil {
		return nil, err
	}
	for rows2.Next() {
		var dk string
		var c int
		if rows2.Scan(&dk, &c) == nil {
			dash.ByDomain[dk] = c
		}
	}
	rows2.Close()

	// Время от создания до последнего обновления статуса (для уже обработанных)
	rowsCl, err := database.DB.Query(`
		SELECT
			CASE
				WHEN EXTRACT(EPOCH FROM (updated_at - created_at)) < 86400 THEN 'under_1d'
				WHEN EXTRACT(EPOCH FROM (updated_at - created_at)) < 259200 THEN 'd1_3d'
				WHEN EXTRACT(EPOCH FROM (updated_at - created_at)) < 604800 THEN 'd3_7d'
				ELSE 'over_7d'
			END AS bucket,
			COUNT(*)::int
		FROM markers
		WHERE LOWER(COALESCE(NULLIF(TRIM(status), ''), 'pending')) IN ('approved', 'rejected', 'resolved')
		GROUP BY 1
	`)
	if err != nil {
		return nil, err
	}
	tmpBuckets := map[string]int{}
	for rowsCl.Next() {
		var b string
		var c int
		if rowsCl.Scan(&b, &c) == nil {
			tmpBuckets[b] = c
		}
	}
	rowsCl.Close()
	order := []string{"under_1d", "d1_3d", "d3_7d", "over_7d"}
	for _, k := range order {
		if n, ok := tmpBuckets[k]; ok {
			dash.ClosureTimeBuckets = append(dash.ClosureTimeBuckets, models.NamedCount{Key: k, Count: n})
		}
	}

	err = database.DB.QueryRow(`
		SELECT
			COUNT(*) FILTER (WHERE LOWER(COALESCE(NULLIF(TRIM(status), ''), 'pending')) = 'rejected')::int,
			COUNT(*) FILTER (WHERE LOWER(COALESCE(NULLIF(TRIM(status), ''), 'pending')) = 'approved')::int,
			COUNT(*) FILTER (WHERE LOWER(COALESCE(NULLIF(TRIM(status), ''), 'pending')) = 'resolved')::int
		FROM markers
	`).Scan(&dash.Rejected, &dash.Approved, &dash.Resolved)
	if err != nil {
		return nil, err
	}
	dash.Processed = dash.Rejected + dash.Approved + dash.Resolved
	if dash.Processed > 0 {
		rate := float64(dash.Rejected) / float64(dash.Processed)
		dash.RejectionRate = &rate
	}
	_ = database.DB.QueryRow(`
		SELECT COUNT(*)::int FROM markers m WHERE
			(LOWER(COALESCE(NULLIF(TRIM(m.status), ''), 'pending')) = 'pending'
			 AND m.response_due_at IS NOT NULL AND m.response_due_at < NOW())
			OR
			(LOWER(COALESCE(NULLIF(TRIM(m.status), ''), 'pending')) IN ('approved', 'in_progress')
			 AND m.resolution_due_at IS NOT NULL AND m.resolution_due_at < NOW())
	`).Scan(&dash.OverdueCount)

	return dash, nil
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
	respDue := ComputeResponseDue(time.Now())
	err := database.DB.QueryRow(`
		INSERT INTO markers (user_id,text,latitude,longitude,image_url,domain_key,group_key,issue_key,ai_confidence,status,response_due_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10) RETURNING id`,
		req.UserID, req.Text, req.Latitude, req.Longitude, req.ImageURL,
		dkey, gkey, ikey, ai, respDue,
	).Scan(&id)
	return id, err
}

func (r *PostgresMarkerRepository) Delete(id int) error {
	_, err := database.DB.Exec("DELETE FROM markers WHERE id=$1", id)
	return err
}

func (r *PostgresMarkerRepository) UpdateStatus(id int, status string, moderatorNote *string) error {
	var domainKey sql.NullString
	err := database.DB.QueryRow(
		`SELECT domain_key FROM markers WHERE id = $1`, id,
	).Scan(&domainKey)
	if err != nil {
		return err
	}
	dk := ""
	if domainKey.Valid {
		dk = strings.TrimSpace(domainKey.String)
	}
	now := time.Now()

	var respDue, resDue, resolvedAt interface{}
	respDue = nil
	resDue = nil
	resolvedAt = nil

	switch status {
	case "pending":
		rd := ComputeResponseDue(now)
		respDue = rd
	case "approved", "in_progress":
		rd := ComputeResolutionDue(now, dk)
		resDue = rd
	case "resolved":
		resolvedAt = now
	}

	if moderatorNote != nil {
		_, err = database.DB.Exec(
			`UPDATE markers SET status = $1, updated_at = CURRENT_TIMESTAMP,
			 response_due_at = $3, resolution_due_at = $4, resolved_at = $5, moderator_note = $6
			 WHERE id = $2`,
			status, id, respDue, resDue, resolvedAt, *moderatorNote,
		)
		return err
	}
	_, err = database.DB.Exec(
		`UPDATE markers SET status = $1, updated_at = CURRENT_TIMESTAMP,
		 response_due_at = $3, resolution_due_at = $4, resolved_at = $5
		 WHERE id = $2`,
		status, id, respDue, resDue, resolvedAt,
	)
	return err
}

func (r *PostgresMarkerRepository) UpdateMarkerMeta(id, userID int, imageAfterURL, addressText string) error {
	if imageAfterURL == "" && addressText == "" {
		return nil
	}
	res, err := database.DB.Exec(`
		UPDATE markers SET
			image_after_url = CASE WHEN $1 <> '' THEN $1 ELSE image_after_url END,
			address_text = CASE WHEN $2 <> '' THEN $2 ELSE address_text END,
			updated_at = CURRENT_TIMESTAMP
		WHERE id = $3 AND (
			user_id = $4
			OR EXISTS (SELECT 1 FROM users WHERE id = $4 AND (is_moderator OR is_admin))
		)`,
		imageAfterURL, addressText, id, userID)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r *PostgresMarkerRepository) UpdateText(id, userID int, text string) error {
	res, err := database.DB.Exec(`
		UPDATE markers SET text = $1, updated_at = CURRENT_TIMESTAMP
		WHERE id = $2 AND user_id = $3
		  AND LOWER(COALESCE(NULLIF(TRIM(status), ''), 'pending')) = 'pending'`,
		strings.TrimSpace(text), id, userID)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
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

func (r *PostgresMarkerRepository) GetMarkerOwnerUserID(markerID int) (int, error) {
	var uid sql.NullInt64
	err := database.DB.QueryRow("SELECT user_id FROM markers WHERE id = $1", markerID).Scan(&uid)
	if err != nil {
		return 0, err
	}
	if !uid.Valid {
		return 0, sql.ErrNoRows
	}
	return int(uid.Int64), nil
}
