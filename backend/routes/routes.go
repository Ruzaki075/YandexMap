package routes

import (
	"backend/handlers"
	"backend/middleware"
	"net/http"
	"os"
	"strings"

	"github.com/gorilla/mux"
)

func corsMiddleware(next http.Handler) http.Handler {
	allowed := []string{"http://localhost:5173"}
	if raw := strings.TrimSpace(os.Getenv("CORS_ORIGINS")); raw != "" {
		parts := strings.Split(raw, ",")
		var out []string
		for _, p := range parts {
			p = strings.TrimSpace(p)
			if p != "" {
				out = append(out, p)
			}
		}
		if len(out) > 0 {
			allowed = out
		}
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		allow := ""
		for _, o := range allowed {
			if o == origin {
				allow = o
				break
			}
		}
		if allow == "" && len(allowed) > 0 {
			allow = allowed[0]
		}
		if allow != "" {
			w.Header().Set("Access-Control-Allow-Origin", allow)
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Access-Control-Max-Age", "3600")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func SetupRoutes(r *mux.Router) {
	r.Use(corsMiddleware)

	r.PathPrefix("/uploads/").Handler(http.StripPrefix("/uploads/", http.FileServer(http.Dir("./uploads"))))

	r.HandleFunc("/api/register", handlers.RegisterHandler).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/login", handlers.LoginHandler).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/logout", handlers.LogoutHandler).Methods("POST", "OPTIONS")

	r.Handle("/api/markers/mine", middleware.JWTMiddleware(http.HandlerFunc(handlers.GetMyMarkersHandler))).Methods("GET", "OPTIONS")

	r.Handle("/api/notifications/unread-count", middleware.JWTMiddleware(http.HandlerFunc(handlers.NotificationsUnreadCountHandler))).Methods("GET", "OPTIONS")
	r.Handle("/api/notifications/read-all", middleware.JWTMiddleware(http.HandlerFunc(handlers.MarkAllNotificationsReadHandler))).Methods("POST", "OPTIONS")
	r.Handle("/api/notifications/{id}/read", middleware.JWTMiddleware(http.HandlerFunc(handlers.MarkNotificationReadHandler))).Methods("PATCH", "OPTIONS")
	r.Handle("/api/notifications", middleware.JWTMiddleware(http.HandlerFunc(handlers.ListNotificationsHandler))).Methods("GET", "OPTIONS")

	r.HandleFunc("/api/markers/{id}/reviews/summary", handlers.ReviewSummaryHandler).Methods("GET", "OPTIONS")
	r.HandleFunc("/api/markers/{id}/reviews", handlers.ListReviewsHandler).Methods("GET", "OPTIONS")
	r.Handle("/api/markers/{id}/reviews/me", middleware.JWTMiddleware(http.HandlerFunc(handlers.GetMyReviewHandler))).Methods("GET", "OPTIONS")
	r.Handle("/api/markers/{id}/reviews", middleware.JWTMiddleware(http.HandlerFunc(handlers.UpsertReviewHandler))).Methods("POST", "OPTIONS")

	r.Handle("/api/moderation/stats", middleware.JWTMiddleware(http.HandlerFunc(handlers.ModerationStatsHandler))).Methods("GET", "OPTIONS")

	r.HandleFunc("/api/markers", handlers.GetMarkersHandler).Methods("GET", "OPTIONS")
	r.Handle("/api/markers", middleware.JWTMiddleware(http.HandlerFunc(handlers.CreateMarkerHandler))).Methods("POST", "OPTIONS")
	r.Handle("/api/markers/{id}", middleware.JWTMiddleware(http.HandlerFunc(handlers.DeleteMarkerHandler))).Methods("DELETE", "OPTIONS")
	r.Handle("/api/markers/{id}/status", middleware.JWTMiddleware(http.HandlerFunc(handlers.UpdateMarkerStatusHandler))).Methods("PATCH", "OPTIONS")
	r.Handle("/api/upload", middleware.JWTMiddleware(http.HandlerFunc(handlers.UploadImageHandler))).Methods("POST", "OPTIONS")

	r.Handle("/api/admin/users", middleware.JWTMiddleware(http.HandlerFunc(handlers.AdminListUsersHandler))).Methods("GET", "OPTIONS")
	r.Handle("/api/admin/users/{id}", middleware.JWTMiddleware(http.HandlerFunc(handlers.AdminPatchUserHandler))).Methods("PATCH", "OPTIONS")
}
