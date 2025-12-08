package main

type User struct {
	ID       int    `json:"id"`
	Email    string `json:"email"`
	Password string `json:"-"`
	Avatar   string `json:"avatar"`
}

type Marker struct {
	ID     int     `json:"id"`
	UserID int     `json:"user_id"`
	Text   string  `json:"text"`
	Lat    float64 `json:"lat"`
	Lng    float64 `json:"lng"`
	Image  string  `json:"image"`
}

type Comment struct {
	ID       int    `json:"id"`
	UserID   int    `json:"user_id"`
	MarkerID int    `json:"marker_id"`
	Text     string `json:"text"`
}
