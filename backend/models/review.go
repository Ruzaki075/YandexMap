package models

import "time"

type MarkerReview struct {
	ID        int       `json:"id"`
	MarkerID  int       `json:"marker_id"`
	UserID    int       `json:"user_id"`
	UserEmail string    `json:"user_email,omitempty"`
	Rating    int       `json:"rating"`
	Comment   string    `json:"comment,omitempty"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type UpsertReviewRequest struct {
	Rating  int    `json:"rating"`
	Comment string `json:"comment,omitempty"`
}
