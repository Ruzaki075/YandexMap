package models

import "time"

// AbuseReportModeration — жалоба для панели модератора.
type AbuseReportModeration struct {
	ID              int        `json:"id"`
	ReporterUserID  int        `json:"reporter_user_id"`
	ReporterEmail   string     `json:"reporter_email"`
	TargetType      string     `json:"target_type"`
	TargetID        int        `json:"target_id"`
	Reason          string     `json:"reason"`
	Details         string     `json:"details,omitempty"`
	Status          string     `json:"status"`
	CreatedAt       time.Time  `json:"created_at"`
	MarkerText      string     `json:"marker_text,omitempty"`
	MarkerStatus    string     `json:"marker_status,omitempty"`
	MarkerDomainKey string     `json:"marker_domain_key,omitempty"`
	MarkerImageURL  string     `json:"marker_image_url,omitempty"`
	MarkerLatitude  *float64   `json:"marker_latitude,omitempty"`
	MarkerLongitude *float64   `json:"marker_longitude,omitempty"`
}
