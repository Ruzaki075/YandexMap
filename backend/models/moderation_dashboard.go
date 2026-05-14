package models

// NamedCount — пара ключ/число для стабильного порядка в JSON (слайс, не map).
type NamedCount struct {
	Key   string `json:"key"`
	Count int    `json:"count"`
}

// ModerationDashboard — сводка для модератора/админа (расширение к by_status / by_domain).
type ModerationDashboard struct {
	Total              int            `json:"total"`
	ByStatus           map[string]int `json:"by_status"`
	ByDomain           map[string]int `json:"by_domain"`
	ClosureTimeBuckets []NamedCount   `json:"closure_time_buckets"`
	Rejected           int            `json:"rejected"`
	Approved           int            `json:"approved"`
	Resolved           int            `json:"resolved"`
	Processed          int            `json:"processed"`
	RejectionRate      *float64       `json:"rejection_rate,omitempty"`
}
