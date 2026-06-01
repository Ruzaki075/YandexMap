package models

import "time"

type MarkerSupport struct {
	ID        int       `json:"id"`
	MarkerID  int       `json:"marker_id"`
	UserID    int       `json:"user_id"`
	UserEmail string    `json:"user_email,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

type NearbyMarker struct {
	ID           int     `json:"id"`
	Text         string  `json:"text"`
	DomainKey    string  `json:"domain_key,omitempty"`
	Status       string  `json:"status"`
	Latitude     float64 `json:"latitude"`
	Longitude    float64 `json:"longitude"`
	DistanceM    float64 `json:"distance_m"`
	SupportCount int     `json:"support_count"`
}
