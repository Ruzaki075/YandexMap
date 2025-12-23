package models

import "time"

type Marker struct {
	ID        int       `json:"id"`
	UserID    int       `json:"user_id"`
	Text      string    `json:"text"`
	Latitude  float64   `json:"latitude"`
	Longitude float64   `json:"longitude"`
	ImageURL  string    `json:"image_url,omitempty"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	UserEmail string    `json:"user_email,omitempty"`
}

type CreateMarkerRequest struct {
	Text      string  `json:"text"`
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	ImageURL  string  `json:"image_url,omitempty"`
	UserID    int     `json:"user_id"`
}
