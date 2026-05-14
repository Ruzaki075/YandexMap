package models

import "time"

type Notification struct {
	ID        int        `json:"id"`
	UserID    int        `json:"user_id"`
	Type      string     `json:"type"`
	MarkerID  *int       `json:"marker_id,omitempty"`
	Title     string     `json:"title"`
	Body      string     `json:"body,omitempty"`
	ReadAt    *time.Time `json:"read_at,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
}
