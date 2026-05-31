package repositories

import (
	"backend/database"
	"backend/models"
	"fmt"
	"strings"
	"time"
)

// ModerationListQuery — серверные фильтры панели модерации.
type ModerationListQuery struct {
	Page         int
	PageSize     int
	Status       string
	DomainKey    string
	Overdue      bool
	HasPhoto     bool
	MinSupports  int
	Unresolved   bool
	MyChecks     bool
	ModeratorUID int
	Search       string
	DateFrom     *time.Time
	DateTo       *time.Time
	Sort         string
}

func overdueSQL(alias string) string {
	a := alias
	if a != "" {
		a += "."
	}
	return fmt.Sprintf(`(
		(LOWER(COALESCE(NULLIF(TRIM(%[1]sstatus), ''), 'pending')) = 'pending'
		 AND %[1]sresponse_due_at IS NOT NULL AND %[1]sresponse_due_at < NOW())
		OR
		(LOWER(COALESCE(NULLIF(TRIM(%[1]sstatus), ''), 'pending')) IN ('approved', 'in_progress')
		 AND %[1]sresolution_due_at IS NOT NULL AND %[1]sresolution_due_at < NOW())
	)`, a)
}

func buildModerationWhere(q ModerationListQuery) (clause string, args []interface{}) {
	var parts []string
	n := 1

	if q.DomainKey != "" && q.DomainKey != "all" {
		if q.DomainKey == "__none__" {
			parts = append(parts, "(m.domain_key IS NULL OR TRIM(m.domain_key) = '')")
		} else {
			parts = append(parts, fmt.Sprintf("m.domain_key = $%d", n))
			args = append(args, q.DomainKey)
			n++
		}
	}

	if q.Status != "" && q.Status != "all" && q.Status != "overdue" {
		parts = append(parts, fmt.Sprintf("LOWER(COALESCE(NULLIF(TRIM(m.status), ''), 'pending')) = $%d", n))
		args = append(args, strings.ToLower(strings.TrimSpace(q.Status)))
		n++
	}

	if q.Overdue || q.Status == "overdue" {
		parts = append(parts, overdueSQL("m"))
	}

	if q.Unresolved {
		parts = append(parts, `LOWER(COALESCE(NULLIF(TRIM(m.status), ''), 'pending')) IN ('pending', 'approved', 'in_progress')`)
	}

	if q.HasPhoto {
		parts = append(parts, `m.image_url IS NOT NULL AND TRIM(m.image_url) <> ''`)
	}

	if q.MinSupports > 0 {
		parts = append(parts, fmt.Sprintf(`(SELECT COUNT(*)::int FROM marker_supports s WHERE s.marker_id = m.id) >= $%d`, n))
		args = append(args, q.MinSupports)
		n++
	}

	if q.MyChecks && q.ModeratorUID > 0 {
		parts = append(parts, fmt.Sprintf(`EXISTS (
			SELECT 1 FROM marker_status_log l
			WHERE l.marker_id = m.id AND l.actor_user_id = $%d
		)`, n))
		args = append(args, q.ModeratorUID)
		n++
	}

	if q.DateFrom != nil {
		parts = append(parts, fmt.Sprintf("m.created_at >= $%d", n))
		args = append(args, *q.DateFrom)
		n++
	}
	if q.DateTo != nil {
		parts = append(parts, fmt.Sprintf("m.created_at < $%d", n))
		args = append(args, *q.DateTo)
		n++
	}

	search := strings.TrimSpace(q.Search)
	if search != "" {
		tsq := strings.ReplaceAll(search, "'", " ")
		parts = append(parts, fmt.Sprintf(`(
			m.search_vector @@ plainto_tsquery('russian', $%d)
			OR m.text ILIKE '%%' || $%d || '%%'
			OR COALESCE(m.address_text, '') ILIKE '%%' || $%d || '%%'
		)`, n, n+1, n+1))
		args = append(args, tsq, search)
		n += 2
	}

	if len(parts) == 0 {
		return "TRUE", args
	}
	return strings.Join(parts, " AND "), args
}

func moderationOrderBy(sort string) string {
	overdue := overdueSQL("m")
	supportSub := `(SELECT COUNT(*)::int FROM marker_supports s WHERE s.marker_id = m.id)`
	switch strings.ToLower(strings.TrimSpace(sort)) {
	case "oldest":
		return "m.created_at ASC"
	case "most_supported":
		return supportSub + " DESC, m.created_at DESC"
	case "overdue_first":
		return fmt.Sprintf("CASE WHEN %s THEN 0 ELSE 1 END, COALESCE(m.response_due_at, m.resolution_due_at) ASC NULLS LAST, m.created_at DESC", overdue)
	case "sla_nearest":
		return `COALESCE(
			CASE WHEN LOWER(COALESCE(NULLIF(TRIM(m.status), ''), 'pending')) = 'pending' THEN m.response_due_at END,
			m.resolution_due_at
		) ASC NULLS LAST, m.created_at DESC`
	case "updated":
		return "m.updated_at DESC, m.created_at DESC"
	default:
		return "m.created_at DESC"
	}
}

// ListModerationMarkers — пагинированный список для панели модерации.
func ListModerationMarkers(q ModerationListQuery) ([]models.Marker, int, error) {
	if q.Page < 1 {
		q.Page = 1
	}
	if q.PageSize < 1 {
		q.PageSize = 40
	}
	if q.PageSize > 100 {
		q.PageSize = 100
	}

	where, args := buildModerationWhere(q)
	countSQL := "SELECT COUNT(*)::int FROM markers m WHERE " + where
	var total int
	if err := database.DB.QueryRow(countSQL, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	offset := (q.Page - 1) * q.PageSize
	limitArg := len(args) + 1
	offsetArg := len(args) + 2
	argsPage := append(append([]interface{}{}, args...), q.PageSize, offset)

	listSQL := markerSelectBase + " WHERE " + where +
		" ORDER BY " + moderationOrderBy(q.Sort) +
		fmt.Sprintf(" LIMIT $%d OFFSET $%d", limitArg, offsetArg)

	rows, err := database.DB.Query(listSQL, argsPage...)
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
