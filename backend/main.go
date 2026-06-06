package main

import (
	"log"
	"net/http"
	"os"

	"backend/database"
	"backend/realtime"
	"backend/repositories"
	"backend/routes"

	"github.com/gorilla/mux"
)

func main() {
	database.ConnectDB()
	realtime.Start()
	repositories.SeedClassificationsIfEmpty()
	defer database.DB.Close()

	if err := os.MkdirAll("uploads/avatars", 0755); err != nil {
		log.Printf("Failed to create uploads directory: %v", err)
	}
	if err := os.MkdirAll("uploads", 0755); err != nil {
		log.Printf("Failed to create uploads directory: %v", err)
	}

	r := mux.NewRouter()
	routes.SetupRoutes(r)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	addr := ":" + port
	log.Printf("Server running on http://0.0.0.0%s", addr)
	log.Fatal(http.ListenAndServe(addr, r))
}
