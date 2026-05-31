package models

import "time"

type Marker struct {
	ID           int       `json:"id"`
	UserID       int       `json:"user_id"`
	Text         string    `json:"text"`
	Latitude     float64   `json:"latitude"`
	Longitude    float64   `json:"longitude"`
	ImageURL      string `json:"image_url,omitempty"`
	ImageAfterURL string `json:"image_after_url,omitempty"`
	AddressText   string `json:"address_text,omitempty"`
	DomainKey    string    `json:"domain_key,omitempty"`
	GroupKey     string    `json:"group_key,omitempty"`
	IssueKey     string    `json:"issue_key,omitempty"`
	AIConfidence *float64  `json:"ai_confidence,omitempty"`
	Status            string     `json:"status"`
	ModeratorNote     string     `json:"moderator_note,omitempty"`
	ResponseDueAt     *time.Time `json:"response_due_at,omitempty"`
	ResolutionDueAt   *time.Time `json:"resolution_due_at,omitempty"`
	ResolvedAt        *time.Time `json:"resolved_at,omitempty"`
	IsOverdue         bool       `json:"is_overdue,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
	UserEmail      string    `json:"user_email,omitempty"`
	ReviewCount    int       `json:"review_count,omitempty"`
	ReviewAvg      *float64  `json:"review_avg,omitempty"`
	SupportCount   int       `json:"support_count,omitempty"`
}

type CreateMarkerRequest struct {
	Text           string   `json:"text"`
	Latitude       float64  `json:"latitude"`
	Longitude      float64  `json:"longitude"`
	ImageURL       string   `json:"image_url,omitempty"`
	ImageLatitude  *float64 `json:"image_latitude,omitempty"`
	ImageLongitude *float64 `json:"image_longitude,omitempty"`
	UserID         int      `json:"user_id"`
	DomainKey      string   `json:"domain_key,omitempty"`
	GroupKey       string   `json:"group_key,omitempty"`
	IssueKey       string   `json:"issue_key,omitempty"`
	AIConfidence   *float64 `json:"ai_confidence,omitempty"`
	ForceCreate    bool     `json:"force_create,omitempty"`
}
