package repositories

import (
	"log"

	"backend/database"
	"backend/utils"
)

// NotifyGeoSubscribers — уведомления подписчикам в радиусе (event: "new" | "resolved").
func NotifyGeoSubscribers(lat, lng float64, markerID, excludeUserID int, event string) {
	var cond string
	var title, bodyTpl string
	switch event {
	case "new":
		cond = "notify_new = TRUE"
		title = "Новое обращение рядом"
		bodyTpl = "В зоне вашей геоподписки появилось обращение."
	case "resolved":
		cond = "notify_resolved = TRUE"
		title = "Проблема решена рядом"
		bodyTpl = "Обращение в зоне подписки отмечено как решённое."
	default:
		return
	}

	rows, err := database.DB.Query(`
		SELECT user_id, COALESCE(label, ''), latitude, longitude, radius_m
		FROM geo_subscriptions WHERE ` + cond)
	if err != nil {
		log.Printf("geo notify query: %v", err)
		return
	}
	defer rows.Close()

	nrepo := NewNotificationRepository()
	mid := markerID
	for rows.Next() {
		var userID, radiusM int
		var label string
		var subLat, subLng float64
		if err := rows.Scan(&userID, &label, &subLat, &subLng, &radiusM); err != nil {
			continue
		}
		if userID == excludeUserID {
			continue
		}
		if utils.HaversineMeters(lat, lng, subLat, subLng) > float64(radiusM) {
			continue
		}
		body := bodyTpl
		if label != "" {
			body += " Зона: «" + label + "»."
		}
		if _, errN := nrepo.Create(userID, "geo_"+event, &mid, title, body); errN != nil {
			log.Printf("geo notify create user=%d: %v", userID, errN)
		}
	}
}
