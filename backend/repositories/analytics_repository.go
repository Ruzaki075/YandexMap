package repositories

import (
	"backend/database"
	"strings"
	"time"
)

type DayCount struct {
	Day   string `json:"day"`
	Count int    `json:"count"`
}

type CategoryCount struct {
	DomainKey string `json:"domain_key"`
	Label     string `json:"label,omitempty"`
	Count     int    `json:"count"`
}

type AnalyticsDashboard struct {
	ByDay       []DayCount      `json:"by_day"`
	ByCategory  []CategoryCount `json:"by_category"`
	SLA         map[string]int  `json:"sla"`
	Total       int             `json:"total"`
	Active      int             `json:"active"`
	Resolved    int             `json:"resolved"`
	Overdue     int             `json:"overdue"`
}

func GetAnalyticsDashboard(days int) (*AnalyticsDashboard, error) {
	if days < 7 {
		days = 30
	}
	if days > 90 {
		days = 90
	}
	d := &AnalyticsDashboard{SLA: map[string]int{}}

	_ = database.DB.QueryRow(`SELECT COUNT(*) FROM markers`).Scan(&d.Total)
	_ = database.DB.QueryRow(`
		SELECT COUNT(*) FROM markers
		WHERE LOWER(COALESCE(status,'pending')) IN ('approved','in_progress')`).Scan(&d.Active)
	_ = database.DB.QueryRow(`
		SELECT COUNT(*) FROM markers WHERE LOWER(COALESCE(status,'')) = 'resolved'`).Scan(&d.Resolved)
	_ = database.DB.QueryRow(`
		SELECT COUNT(*) FROM markers WHERE
		(LOWER(COALESCE(status,'pending')) = 'pending' AND response_due_at < NOW())
		OR (LOWER(COALESCE(status,'')) IN ('approved','in_progress') AND resolution_due_at < NOW())`).Scan(&d.Overdue)

	rows, err := database.DB.Query(`
		SELECT to_char(created_at::date, 'YYYY-MM-DD') AS d, COUNT(*)::int
		FROM markers
		WHERE created_at >= NOW() - ($1 || ' days')::interval
		GROUP BY 1 ORDER BY 1`, days)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var dc DayCount
			if rows.Scan(&dc.Day, &dc.Count) == nil {
				d.ByDay = append(d.ByDay, dc)
			}
		}
	}

	rows2, err := database.DB.Query(`
		SELECT COALESCE(m.domain_key, ''), COALESCE(c.label_ru, m.domain_key, 'Без категории'), COUNT(*)::int
		FROM markers m
		LEFT JOIN classification_domains c ON c.domain_key = m.domain_key
		GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 12`)
	if err == nil {
		defer rows2.Close()
		for rows2.Next() {
			var cc CategoryCount
			if rows2.Scan(&cc.DomainKey, &cc.Label, &cc.Count) == nil {
				d.ByCategory = append(d.ByCategory, cc)
			}
		}
	}

	var onTime, late int
	_ = database.DB.QueryRow(`
		SELECT COUNT(*) FROM markers
		WHERE resolved_at IS NOT NULL AND resolution_due_at IS NOT NULL
		  AND resolved_at <= resolution_due_at`).Scan(&onTime)
	_ = database.DB.QueryRow(`
		SELECT COUNT(*) FROM markers
		WHERE resolved_at IS NOT NULL AND resolution_due_at IS NOT NULL
		  AND resolved_at > resolution_due_at`).Scan(&late)
	d.SLA["on_time"] = onTime
	d.SLA["late"] = late
	return d, nil
}

func UserActivityCalendar(userID int, year int) (map[string]int, error) {
	if year < 2020 {
		year = time.Now().Year()
	}
	rows, err := database.DB.Query(`
		SELECT to_char(created_at::date, 'YYYY-MM-DD'), COUNT(*)::int
		FROM markers WHERE user_id = $1
		  AND EXTRACT(YEAR FROM created_at) = $2
		GROUP BY 1`, userID, year)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]int{}
	for rows.Next() {
		var day string
		var n int
		if rows.Scan(&day, &n) == nil {
			out[day] = n
		}
	}
	return out, nil
}

func PublicUserProfile(userID int) (map[string]interface{}, error) {
	var email, displayName, bio, avatar string
	var karma, createdYear int
	err := database.DB.QueryRow(`
		SELECT email, COALESCE(display_name,''), COALESCE(bio,''),
		       COALESCE(avatar_url,''), karma_points,
		       EXTRACT(YEAR FROM created_at)::int
		FROM users WHERE id = $1`, userID).Scan(
		&email, &displayName, &bio, &avatar, &karma, &createdYear)
	if err != nil {
		return nil, err
	}
	masked := maskEmail(email)
	var total, resolved int
	_ = database.DB.QueryRow(`SELECT COUNT(*) FROM markers WHERE user_id = $1`, userID).Scan(&total)
	_ = database.DB.QueryRow(`
		SELECT COUNT(*) FROM markers WHERE user_id = $1 AND LOWER(status) = 'resolved'`,
		userID).Scan(&resolved)
	var avgRating *float64
	var reviewCnt int
	_ = database.DB.QueryRow(`
		SELECT COUNT(*)::int, AVG(r.rating)::float8
		FROM marker_reviews r
		JOIN markers m ON m.id = r.marker_id WHERE m.user_id = $1`,
		userID).Scan(&reviewCnt, &avgRating)

	badges := []string{}
	if karma >= 50 {
		badges = append(badges, "activist")
	}
	if resolved >= 5 {
		badges = append(badges, "problem_solver")
	}
	if total >= 10 {
		badges = append(badges, "reporter")
	}

	repo := NewMarkerRepository()
	recent, _ := repo.ListByUserID(userID)
	if len(recent) > 8 {
		recent = recent[:8]
	}

	return map[string]interface{}{
		"user_id":       userID,
		"email_masked":  masked,
		"display_name":  displayName,
		"bio":           bio,
		"avatar_url":    avatar,
		"karma_points":  karma,
		"member_since":  createdYear,
		"markers_total": total,
		"resolved_count": resolved,
		"review_count":  reviewCnt,
		"review_avg":    avgRating,
		"badges":        badges,
		"recent_markers": recent,
	}, nil
}

func maskEmail(email string) string {
	at := strings.Index(email, "@")
	if at < 2 {
		return "***"
	}
	return email[:2] + "***" + email[at:]
}

func LeaderboardByPeriod(period string, limit int) ([]map[string]interface{}, error) {
	if limit < 1 || limit > 50 {
		limit = 20
	}
	interval := "30 days"
	switch period {
	case "week":
		interval = "7 days"
	case "month":
		interval = "30 days"
	case "all":
		return GetLeaderboard(limit)
	}
	rows, err := database.DB.Query(`
		SELECT u.id, u.email, COALESCE(NULLIF(TRIM(u.display_name), ''), '') AS display_name,
		       COUNT(*)::int AS cnt, COALESCE(u.avatar_url,'')
		FROM markers m
		JOIN users u ON u.id = m.user_id
		WHERE m.created_at >= NOW() - $1::interval
		  AND LOWER(COALESCE(m.status,'')) IN ('approved','resolved','in_progress')
		GROUP BY u.id, u.email, u.display_name, u.avatar_url
		ORDER BY cnt DESC, u.karma_points DESC
		LIMIT $2`, interval, limit)
	if err != nil {
		return GetLeaderboard(limit)
	}
	defer rows.Close()
	var list []map[string]interface{}
	rank := 1
	for rows.Next() {
		var id, cnt int
		var email, displayName, avatar string
		if rows.Scan(&id, &email, &displayName, &cnt, &avatar) != nil {
			continue
		}
		list = append(list, map[string]interface{}{
			"rank": rank, "user_id": id, "email": email,
			"karma_points": cnt, "avatar_url": avatar, "period_score": cnt,
		})
		if displayName != "" {
			list[len(list)-1]["display_name"] = displayName
		}
		rank++
	}
	return list, nil
}
