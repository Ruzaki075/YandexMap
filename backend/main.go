package main

import (
	"log"
	"net/http"
	"os"

	"backend/database"
	"backend/routes"

	"github.com/gorilla/mux"
)

func main() {
	database.ConnectDB()
	defer database.DB.Close()

	if err := os.MkdirAll("uploads", 0755); err != nil {
		log.Printf("Failed to create uploads directory: %v", err)
	}

	r := mux.NewRouter()
	routes.SetupRoutes(r)

	port := ":8080"
	log.Printf("Server running on http://localhost%s", port)
	log.Fatal(http.ListenAndServe(port, r))
}
