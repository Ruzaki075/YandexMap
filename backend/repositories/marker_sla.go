package repositories

import (
	"database/sql"
	"strings"
	"time"

	"backend/database"
	"backend/models"
)

const DefaultResponseDays = 3
const DefaultResolutionDays = 14

var seedResolutionDays = map[string]int{
	"roads":      14,
	"transit":    21,
	"pedestrian": 14,
	"utilities":  30,
	"social":     45,
}

func ResolutionDaysForDomain(domainKey string) int {
	domainKey = strings.TrimSpace(domainKey)
	if domainKey == "" {
		return DefaultResolutionDays
	}
	var days sql.NullInt64
	err := database.DB.QueryRow(
		`SELECT resolution_days FROM classification_domains WHERE domain_key = $1`,
		domainKey,
	).Scan(&days)
	if err != nil || !days.Valid || days.Int64 < 1 {
		if d, ok := seedResolutionDays[domainKey]; ok {
			return d
		}
		return DefaultResolutionDays
	}
	return int(days.Int64)
}

func EnrichMarkerSLA(m *models.Marker) {
	now := time.Now()
	m.IsOverdue = false
	st := strings.ToLower(strings.TrimSpace(m.Status))
	if st == "" {
		st = "pending"
	}
	if st == "resolved" || st == "rejected" {
		return
	}
	if st == "pending" && m.ResponseDueAt != nil && now.After(*m.ResponseDueAt) {
		m.IsOverdue = true
		return
	}
	if (st == "approved" || st == "in_progress") && m.ResolutionDueAt != nil && now.After(*m.ResolutionDueAt) {
		m.IsOverdue = true
	}
}

func ComputeResolutionDue(from time.Time, domainKey string) time.Time {
	return from.AddDate(0, 0, ResolutionDaysForDomain(domainKey))
}

func ComputeResponseDue(from time.Time) time.Time {
	return from.AddDate(0, 0, DefaultResponseDays)
}
