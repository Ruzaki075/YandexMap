package services

import (
	"database/sql"
	"fmt"
	"log"

	"backend/database"
	"backend/realtime"
	"backend/repositories"
)

// Правила начисления баллов (как в «Активном гражданине»).
const (
	PointsMarkerCreated   = 20
	PointsMarkerInProgress = 10
	PointsMarkerResolved  = 50
	PointsCommentAdded    = 5
	PointsVoteCast        = 10
	PointsOfficialReply   = 5
)

var levelThresholds = []struct {
	level  int
	minPts int
	name   string
}{
	{1, 0, "Житель"},
	{2, 200, "Активист"},
	{3, 600, "Общественник"},
	{4, 1500, "Эксперт"},
	{5, 4000, "Лидер города"},
}

// LevelFromPoints возвращает уровень и название по сумме баллов.
func LevelFromPoints(points int) (level int, name string) {
	level, name = 1, levelThresholds[0].name
	for _, t := range levelThresholds {
		if points >= t.minPts {
			level, name = t.level, t.name
		}
	}
	return level, name
}

// NextLevelProgress — баллы до следующего уровня.
func NextLevelProgress(points int) (nextLevel int, pointsNeeded int, maxForLevel int) {
	for i, t := range levelThresholds {
		if points < t.minPts {
			nextLevel = t.level
			pointsNeeded = t.minPts - points
			if i > 0 {
				maxForLevel = t.minPts - levelThresholds[i-1].minPts
			} else {
				maxForLevel = t.minPts
			}
			return
		}
	}
	return 0, 0, 0
}

func ensureUserPointsRow(tx *sql.Tx, userID int) error {
	_, err := tx.Exec(`
		INSERT INTO user_points (user_id, points, total_earned, level)
		VALUES ($1, 0, 0, 1)
		ON CONFLICT (user_id) DO NOTHING`, userID)
	return err
}

// AwardPoints начисляет баллы, пишет лог, обновляет уровень, проверяет достижения.
func AwardPoints(userID int, action string, points int, description string, markerID *int) {
	if userID <= 0 || points == 0 {
		return
	}
	tx, err := database.DB.Begin()
	if err != nil {
		log.Printf("points: begin tx: %v", err)
		return
	}
	defer tx.Rollback()

	if err := ensureUserPointsRow(tx, userID); err != nil {
		log.Printf("points: ensure row: %v", err)
		return
	}

	var mid interface{}
	if markerID != nil {
		mid = *markerID
	}
	if _, err := tx.Exec(`
		INSERT INTO points_log (user_id, action, points, description, marker_id)
		VALUES ($1, $2, $3, $4, $5)`,
		userID, action, points, nullStr(description), mid); err != nil {
		log.Printf("points: log: %v", err)
		return
	}

	var total int
	if err := tx.QueryRow(`
		UPDATE user_points SET
			points = points + $2,
			total_earned = total_earned + $2,
			updated_at = NOW()
		WHERE user_id = $1
		RETURNING points`, userID, points).Scan(&total); err != nil {
		log.Printf("points: update: %v", err)
		return
	}

	lvl, _ := LevelFromPoints(total)
	if _, err := tx.Exec(`UPDATE user_points SET level = $2 WHERE user_id = $1`, userID, lvl); err != nil {
		log.Printf("points: level: %v", err)
	}

	if err := tx.Commit(); err != nil {
		log.Printf("points: commit: %v", err)
		return
	}

	checkAndGrantAchievements(userID)
}

func nullStr(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}

func checkAndGrantAchievements(userID int) {
	stats, err := userStatsForAchievements(userID)
	if err != nil {
		return
	}
	rows, err := database.DB.Query(`
		SELECT id, key, name_ru, description_ru, icon, points_reward, condition_type, condition_value
		FROM achievements`)
	if err != nil {
		return
	}
	defer rows.Close()

	nrepo := repositories.NewNotificationRepository()
	for rows.Next() {
		var id, reward, need int
		var key, name, desc, icon, condType string
		if err := rows.Scan(&id, &key, &name, &desc, &icon, &reward, &condType, &need); err != nil {
			continue
		}
		var cur int
		switch condType {
		case "markers_count":
			cur = stats.markersCount
		case "resolved_count":
			cur = stats.resolvedCount
		case "streak_days":
			cur = stats.streakDays
		case "votes_count":
			cur = stats.votesCount
		default:
			continue
		}
		if cur < need {
			continue
		}
		var exists bool
		_ = database.DB.QueryRow(
			`SELECT EXISTS(SELECT 1 FROM user_achievements WHERE user_id = $1 AND achievement_id = $2)`,
			userID, id,
		).Scan(&exists)
		if exists {
			continue
		}
		_, err := database.DB.Exec(
			`INSERT INTO user_achievements (user_id, achievement_id) VALUES ($1, $2)`,
			userID, id,
		)
		if err != nil {
			continue
		}
		if reward > 0 {
			AwardPoints(userID, "achievement_bonus", reward, "Бонус за достижение: "+name, nil)
		}
		title := fmt.Sprintf("%s Новое достижение: %s", icon, name)
		body := desc
		if reward > 0 {
			body += fmt.Sprintf("\n\n+%d баллов", reward)
		}
		nid, _ := nrepo.Create(userID, "achievement_earned", nil, title, body)
		realtime.BroadcastToUser(userID, realtime.Event{
			Type: "achievement_earned",
			Payload: map[string]interface{}{
				"id": nid, "title": title, "body": body, "icon": icon, "achievement_key": key,
			},
		})
	}
}

type userAchievementStats struct {
	markersCount  int
	resolvedCount int
	streakDays    int
	votesCount    int
}

func userStatsForAchievements(userID int) (userAchievementStats, error) {
	var s userAchievementStats
	err := database.DB.QueryRow(`
		SELECT
			(SELECT COUNT(*)::int FROM markers WHERE user_id = $1),
			(SELECT COUNT(*)::int FROM markers WHERE user_id = $1 AND LOWER(COALESCE(status,'')) = 'resolved'),
			COALESCE((SELECT login_streak FROM users WHERE id = $1), 0),
			(SELECT COUNT(DISTINCT poll_id)::int FROM poll_votes WHERE user_id = $1)
	`, userID).Scan(&s.markersCount, &s.resolvedCount, &s.streakDays, &s.votesCount)
	return s, err
}

// ProcessLoginStreak — ежедневный вход и бонус streak.
func ProcessLoginStreak(userID int) (streak int, bonus int) {
	if userID <= 0 {
		return 0, 0
	}
	var last sql.NullTime
	var cur int
	_ = database.DB.QueryRow(
		`SELECT last_login_date, login_streak FROM users WHERE id = $1`, userID,
	).Scan(&last, &cur)

	var isSame, isYesterday bool
	_ = database.DB.QueryRow(`
		SELECT
			(last_login_date = CURRENT_DATE),
			(last_login_date = CURRENT_DATE - INTERVAL '1 day')
		FROM users WHERE id = $1`, userID).Scan(&isSame, &isYesterday)

	if isSame {
		return cur, 0
	}
	newStreak := 1
	if isYesterday {
		newStreak = cur + 1
	}
	bonus = 5 * newStreak
	if bonus > 30 {
		bonus = 30
	}
	_, _ = database.DB.Exec(`
		UPDATE users SET last_login_date = CURRENT_DATE, login_streak = $2 WHERE id = $1`,
		userID, newStreak,
	)
	if bonus > 0 {
		AwardPoints(userID, "streak_bonus", bonus,
			fmt.Sprintf("Ежедневный вход (серия %d дн.)", newStreak), nil)
	}
	return newStreak, bonus
}

// GetUserPointsSummary для API профиля.
func GetUserPointsSummary(userID int) (map[string]interface{}, error) {
	ensureRow := func() {
		_, _ = database.DB.Exec(`
			INSERT INTO user_points (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, userID)
	}
	ensureRow()

	var points, total, level int
	err := database.DB.QueryRow(`
		SELECT COALESCE(points,0), COALESCE(total_earned,0), COALESCE(level,1)
		FROM user_points WHERE user_id = $1`, userID).Scan(&points, &total, &level)
	if err == sql.ErrNoRows {
		points, total, level = 0, 0, 1
	} else if err != nil {
		return nil, err
	}
	lvl, lvlName := LevelFromPoints(points)
	nextLvl, need, span := NextLevelProgress(points)
	var streak int
	_ = database.DB.QueryRow(`SELECT COALESCE(login_streak,0) FROM users WHERE id = $1`, userID).Scan(&streak)

	return map[string]interface{}{
		"points":              points,
		"total_earned":        total,
		"level":               lvl,
		"level_name":          lvlName,
		"next_level":          nextLvl,
		"points_to_next":      need,
		"current_level_span":  span,
		"login_streak":        streak,
	}, nil
}
