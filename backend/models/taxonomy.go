package models

type TaxonomyDomain struct {
	Key                string   `json:"key"`
	LabelRu            string   `json:"label_ru"`
	MarkerIcon         string   `json:"marker_icon,omitempty"`
	ResolutionDays     int      `json:"resolution_days,omitempty"`
	TrainingPhrasesRu  []string `json:"training_phrases_ru,omitempty"`
}

type Taxonomy struct {
	Version       int              `json:"version"`
	DescriptionRu string           `json:"description_ru,omitempty"`
	Domains       []TaxonomyDomain `json:"domains"`
}

type CreateClassificationRequest struct {
	Key               string   `json:"key"`
	LabelRu           string   `json:"label_ru"`
	MarkerIcon        string   `json:"marker_icon,omitempty"`
	ResolutionDays    int      `json:"resolution_days,omitempty"`
	TrainingPhrasesRu []string `json:"training_phrases_ru,omitempty"`
}

type UpdateClassificationRequest struct {
	LabelRu           *string  `json:"label_ru,omitempty"`
	MarkerIcon        *string  `json:"marker_icon,omitempty"`
	ResolutionDays    *int     `json:"resolution_days,omitempty"`
	TrainingPhrasesRu []string `json:"training_phrases_ru,omitempty"`
	SortOrder         *int     `json:"sort_order,omitempty"`
}

type AdminClassificationRow struct {
	Key               string   `json:"key"`
	LabelRu           string   `json:"label_ru"`
	MarkerIcon        string   `json:"marker_icon"`
	ResolutionDays    int      `json:"resolution_days"`
	SortOrder         int      `json:"sort_order"`
	MarkersCount      int      `json:"markers_count"`
	ResolvedCount     int      `json:"resolved_count"`
	OverdueCount      int      `json:"overdue_count"`
	ResolvedPct       float64  `json:"resolved_pct"`
	AvgResolutionDays   *float64 `json:"avg_resolution_days,omitempty"`
	TrainingPhrasesRu   []string `json:"training_phrases_ru,omitempty"`
}

type ReorderClassificationsRequest struct {
	Keys []string `json:"keys"`
}
