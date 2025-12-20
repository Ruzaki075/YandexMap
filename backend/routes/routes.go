package routes

import (
	"backend/handlers"
	"net/http"

	"github.com/gorilla/mux"
)

func SetupRoutes(r *mux.Router) {
	r.Use(corsMiddleware)

	r.PathPrefix("/uploads/").Handler(http.StripPrefix("/uploads/", http.FileServer(http.Dir("./uploads"))))

	r.HandleFunc("/api/register", handlers.RegisterHandler).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/login", handlers.LoginHandler).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/logout", handlers.LogoutHandler).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/markers", handlers.GetMarkersHandler).Methods("GET", "OPTIONS")
	r.HandleFunc("/api/markers", handlers.CreateMarkerHandler).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/markers/{id}", handlers.DeleteMarkerHandler).Methods("DELETE", "OPTIONS")
	r.HandleFunc("/api/upload", handlers.UploadImageHandler).Methods("POST", "OPTIONS")
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "http://localhost:5173")
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
