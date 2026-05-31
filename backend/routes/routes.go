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
	// localhost и 127.0.0.1 — разные origin; без обоих типичный dev-URL даёт «Failed to fetch» в браузере.
	allowed := []string{
		"http://localhost:5173",
		"http://127.0.0.1:5173",
		"http://localhost:4173",
		"http://127.0.0.1:4173",
	}
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
		// Только точное совпадение Origin; подстановка «первого» из списка ломает CORS и даёт Failed to fetch.
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
	r.Handle("/api/me", middleware.JWTMiddleware(http.HandlerFunc(handlers.MeHandler))).Methods("GET", "OPTIONS")
	r.Handle("/api/me/avatar", middleware.JWTMiddleware(http.HandlerFunc(handlers.UploadAvatarHandler))).Methods("POST", "OPTIONS")
	r.Handle("/api/me/avatar", middleware.JWTMiddleware(http.HandlerFunc(handlers.DeleteAvatarHandler))).Methods("DELETE", "OPTIONS")
	r.Handle("/api/me/password", middleware.JWTMiddleware(http.HandlerFunc(handlers.ChangePasswordHandler))).Methods("PATCH", "OPTIONS")
	r.Handle("/api/me/profile", middleware.JWTMiddleware(http.HandlerFunc(handlers.PatchMyProfileHandler))).Methods("PATCH", "OPTIONS")

	r.Handle("/api/markers/mine", middleware.JWTMiddleware(http.HandlerFunc(handlers.GetMyMarkersHandler))).Methods("GET", "OPTIONS")

	r.Handle("/api/notifications/unread-count", middleware.JWTMiddleware(http.HandlerFunc(handlers.NotificationsUnreadCountHandler))).Methods("GET", "OPTIONS")
	r.Handle("/api/notifications/read-all", middleware.JWTMiddleware(http.HandlerFunc(handlers.MarkAllNotificationsReadHandler))).Methods("POST", "OPTIONS")
	r.Handle("/api/notifications/{id}/read", middleware.JWTMiddleware(http.HandlerFunc(handlers.MarkNotificationReadHandler))).Methods("PATCH", "OPTIONS")
	r.Handle("/api/notifications", middleware.JWTMiddleware(http.HandlerFunc(handlers.ListNotificationsHandler))).Methods("GET", "OPTIONS")

	r.HandleFunc("/api/markers/{id}/comments", handlers.GetComments).Methods("GET", "OPTIONS")
	r.Handle("/api/markers/{id}/comments", middleware.JWTMiddleware(http.HandlerFunc(handlers.CreateMarkerCommentHandler))).Methods("POST", "OPTIONS")

	r.HandleFunc("/api/markers/{id}/reviews/summary", handlers.ReviewSummaryHandler).Methods("GET", "OPTIONS")
	r.HandleFunc("/api/markers/{id}/reviews", handlers.ListReviewsHandler).Methods("GET", "OPTIONS")
	r.Handle("/api/markers/{id}/reviews/me", middleware.JWTMiddleware(http.HandlerFunc(handlers.GetMyReviewHandler))).Methods("GET", "OPTIONS")
	r.Handle("/api/markers/{id}/reviews", middleware.JWTMiddleware(http.HandlerFunc(handlers.UpsertReviewHandler))).Methods("POST", "OPTIONS")

	r.Handle("/api/moderation/stats", middleware.JWTMiddleware(http.HandlerFunc(handlers.ModerationStatsHandler))).Methods("GET", "OPTIONS")
	r.Handle("/api/moderation/markers", middleware.JWTMiddleware(http.HandlerFunc(handlers.ListModerationMarkersHandler))).Methods("GET", "OPTIONS")
	r.Handle("/api/moderation/markers/bulk-status", middleware.JWTMiddleware(http.HandlerFunc(handlers.BulkUpdateMarkerStatusHandler))).Methods("POST", "OPTIONS")
	r.Handle("/api/moderation/abuse-reports", middleware.JWTMiddleware(http.HandlerFunc(handlers.ListModerationAbuseReportsHandler))).Methods("GET", "OPTIONS")
	r.Handle("/api/moderation/abuse-reports/{id}", middleware.JWTMiddleware(http.HandlerFunc(handlers.PatchModerationAbuseReportHandler))).Methods("PATCH", "OPTIONS")

	r.HandleFunc("/api/markers", handlers.GetMarkersHandler).Methods("GET", "OPTIONS")
	r.Handle("/api/markers", middleware.JWTMiddleware(http.HandlerFunc(handlers.CreateMarkerHandler))).Methods("POST", "OPTIONS")
	r.Handle("/api/markers/{id}", middleware.JWTMiddleware(http.HandlerFunc(handlers.DeleteMarkerHandler))).Methods("DELETE", "OPTIONS")
	r.Handle("/api/markers/{id}", middleware.JWTMiddleware(http.HandlerFunc(handlers.PatchMarkerHandler))).Methods("PATCH", "OPTIONS")
	r.HandleFunc("/api/markers/{id}/status-history", handlers.GetMarkerStatusHistoryHandler).Methods("GET", "OPTIONS")
	r.Handle("/api/markers/{id}/status", middleware.JWTMiddleware(http.HandlerFunc(handlers.UpdateMarkerStatusHandler))).Methods("PATCH", "OPTIONS")

	r.Handle("/api/geo-subscriptions", middleware.JWTMiddleware(http.HandlerFunc(handlers.ListGeoSubscriptionsHandler))).Methods("GET", "OPTIONS")
	r.Handle("/api/geo-subscriptions", middleware.JWTMiddleware(http.HandlerFunc(handlers.CreateGeoSubscriptionHandler))).Methods("POST", "OPTIONS")
	r.Handle("/api/geo-subscriptions/{id}", middleware.JWTMiddleware(http.HandlerFunc(handlers.DeleteGeoSubscriptionHandler))).Methods("DELETE", "OPTIONS")
	r.Handle("/api/upload", middleware.JWTMiddleware(http.HandlerFunc(handlers.UploadImageHandler))).Methods("POST", "OPTIONS")

	r.Handle("/api/admin/users", middleware.JWTMiddleware(http.HandlerFunc(handlers.AdminListUsersHandler))).Methods("GET", "OPTIONS")
	r.Handle("/api/admin/users/{id}", middleware.JWTMiddleware(http.HandlerFunc(handlers.AdminPatchUserHandler))).Methods("PATCH", "OPTIONS")

	r.HandleFunc("/api/taxonomy", handlers.GetTaxonomyHandler).Methods("GET", "OPTIONS")
	r.HandleFunc("/api/stats/map", handlers.PublicMapStatsHandler).Methods("GET", "OPTIONS")
	r.HandleFunc("/api/stats/heatmap", handlers.HeatmapPointsHandler).Methods("GET", "OPTIONS")
	r.HandleFunc("/api/leaderboard", handlers.LeaderboardHandler).Methods("GET", "OPTIONS")
	r.HandleFunc("/api/leaderboard/season", handlers.LeaderboardSeasonHandler).Methods("GET", "OPTIONS")
	r.HandleFunc("/api/search", handlers.SearchMarkersHandler).Methods("GET", "OPTIONS")
	r.HandleFunc("/api/analytics/dashboard", handlers.AnalyticsDashboardHandler).Methods("GET", "OPTIONS")
	r.HandleFunc("/api/realtime/stats", handlers.RealtimeStatsHandler).Methods("GET", "OPTIONS")
	r.HandleFunc("/api/ws", handlers.WebSocketHandler)

	r.HandleFunc("/api/markers/{id}/timeline", handlers.MarkerTimelineHandler).Methods("GET", "OPTIONS")
	r.HandleFunc("/api/users/{id}/public", handlers.PublicUserProfileHandler).Methods("GET", "OPTIONS")
	r.HandleFunc("/api/users/{id}/activity", handlers.UserActivityCalendarHandler).Methods("GET", "OPTIONS")

	r.Handle("/api/favorites", middleware.JWTMiddleware(http.HandlerFunc(handlers.ListFavoritesHandler))).Methods("GET", "OPTIONS")
	r.Handle("/api/favorites", middleware.JWTMiddleware(http.HandlerFunc(handlers.AddFavoriteHandler))).Methods("POST", "OPTIONS")
	r.Handle("/api/favorites/{markerId}", middleware.JWTMiddleware(http.HandlerFunc(handlers.RemoveFavoriteHandler))).Methods("DELETE", "OPTIONS")
	r.Handle("/api/favorites/{markerId}/status", middleware.JWTMiddleware(http.HandlerFunc(handlers.FavoriteStatusHandler))).Methods("GET", "OPTIONS")

	r.Handle("/api/abuse-reports", middleware.JWTMiddleware(http.HandlerFunc(handlers.PostAbuseReportHandler))).Methods("POST", "OPTIONS")
	r.Handle("/api/admin/audit-log", middleware.JWTMiddleware(http.HandlerFunc(handlers.AdminAuditLogHandler))).Methods("GET", "OPTIONS")
	r.HandleFunc("/api/markers/nearby", handlers.NearbyMarkersHandler).Methods("GET", "OPTIONS")

	r.HandleFunc("/api/markers/{id}/supports", handlers.GetMarkerSupportsHandler).Methods("GET", "OPTIONS")
	r.Handle("/api/markers/{id}/supports", middleware.JWTMiddleware(http.HandlerFunc(handlers.PostMarkerSupportHandler))).Methods("POST", "OPTIONS")
	r.Handle("/api/markers/{id}/supports", middleware.JWTMiddleware(http.HandlerFunc(handlers.DeleteMarkerSupportHandler))).Methods("DELETE", "OPTIONS")

	r.Handle("/api/admin/classifications", middleware.JWTMiddleware(http.HandlerFunc(handlers.AdminListClassificationsHandler))).Methods("GET", "OPTIONS")
	r.Handle("/api/admin/classifications", middleware.JWTMiddleware(http.HandlerFunc(handlers.AdminCreateClassificationHandler))).Methods("POST", "OPTIONS")
	r.Handle("/api/admin/classifications/reorder", middleware.JWTMiddleware(http.HandlerFunc(handlers.AdminReorderClassificationsHandler))).Methods("POST", "OPTIONS")
	r.Handle("/api/admin/classifications/{key}", middleware.JWTMiddleware(http.HandlerFunc(handlers.AdminPatchClassificationHandler))).Methods("PATCH", "OPTIONS")
	r.Handle("/api/admin/classifications/{key}", middleware.JWTMiddleware(http.HandlerFunc(handlers.AdminDeleteClassificationHandler))).Methods("DELETE", "OPTIONS")
}
