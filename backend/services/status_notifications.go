package services

import (
	"log"
	"strings"

	"backend/database"
	"backend/realtime"
	"backend/repositories"
)

// HandleMarkerStatusChange — уведомления и баллы при смене статуса маркера.
func HandleMarkerStatusChange(markerID, ownerID int, oldStatus, newStatus string, notePtr *string, snippet string) {
	oldStatus = strings.ToLower(strings.TrimSpace(oldStatus))
	newStatus = strings.ToLower(strings.TrimSpace(newStatus))
	if ownerID <= 0 || oldStatus == newStatus {
		return
	}

	snip := snippet
	if len([]rune(snip)) > 200 {
		r := []rune(snip)
		snip = string(r[:200]) + "…"
	}

	nrepo := repositories.NewNotificationRepository()
	mid := markerID
	var title, body string

	switch {
	case oldStatus == "pending" && newStatus == "approved":
		title = "✅ Ваше обращение принято на рассмотрение"
		body = "Модератор одобрил заявку — она видна на карте.\n\n«" + snip + "»"
	case newStatus == "in_progress":
		title = "🔧 Ваше обращение взято в работу"
		body = "По вашему обращению начаты работы.\n\n«" + snip + "»"
		markerIDPtr := markerID
		AwardPoints(ownerID, "marker_in_progress", PointsMarkerInProgress, "Обращение взято в работу", &markerIDPtr)
	case newStatus == "resolved":
		title = "🎉 Ваше обращение решено! +50 баллов"
		body = "Модератор отметил обращение как решённое.\n\n«" + snip + "»"
		markerIDPtr := markerID
		AwardPoints(ownerID, "marker_resolved", PointsMarkerResolved, "Обращение решено", &markerIDPtr)
	case newStatus == "rejected":
		title = "❌ Ваше обращение отклонено"
		body = "Модератор отклонил заявку.\n\n«" + snip + "»"
		if notePtr != nil && strings.TrimSpace(*notePtr) != "" {
			body += "\n\nПричина: " + strings.TrimSpace(*notePtr)
		}
	default:
		return
	}

	notifType := "marker_status_" + newStatus
	nid, err := nrepo.Create(ownerID, notifType, &mid, title, body)
	if err != nil {
		log.Printf("status_notifications: %v", err)
		return
	}
	realtime.BroadcastToUser(ownerID, realtime.Event{
		Type: realtime.EventNotification,
		Payload: map[string]interface{}{
			"id": nid, "title": title, "body": body, "marker_id": markerID, "notif_type": notifType,
		},
	})

	if newStatus == "resolved" {
		var lat, lng float64
		if err := database.DB.QueryRow(
			`SELECT latitude, longitude FROM markers WHERE id = $1`, markerID,
		).Scan(&lat, &lng); err == nil {
			go repositories.NotifyGeoSubscribers(lat, lng, markerID, ownerID, "resolved")
		}
	}
}
