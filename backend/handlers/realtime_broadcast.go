package handlers

import "backend/realtime"

func broadcastMarkerCreated(marker interface{}) {
	realtime.Broadcast(realtime.Event{
		Type:    realtime.EventMarkerCreated,
		Payload: marker,
	})
}

func broadcastMarkerUpdated(markerID int, fields map[string]interface{}) {
	payload := map[string]interface{}{"id": markerID}
	for k, v := range fields {
		payload[k] = v
	}
	realtime.Broadcast(realtime.Event{
		Type:    realtime.EventMarkerUpdated,
		Payload: payload,
	})
}

func broadcastUserNotification(userID int, notification interface{}) {
	realtime.BroadcastToUser(userID, realtime.Event{
		Type:    realtime.EventNotification,
		Payload: notification,
	})
}
