package database

import (
	"database/sql"
	"log"
	"time"

	_ "github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
)

var DB *sql.DB

func ConnectDB() {
	connStr := "host=localhost port=5432 user=postgres password=Chernig007or dbname=yandexmap sslmode=disable"

	var err error
	DB, err = sql.Open("postgres", connStr)
	if err != nil {
		log.Fatal("Failed to open DB:", err)
	}

	DB.SetMaxOpenConns(25)
	DB.SetMaxIdleConns(25)
	DB.SetConnMaxLifetime(5 * time.Minute)

	if err = DB.Ping(); err != nil {
		log.Fatal("Failed to ping DB:", err)
	}

	createTables()
	log.Println("PostgreSQL connected")
}

func createTables() {
	DB.Exec(`DROP TABLE IF EXISTS markers CASCADE`)
	DB.Exec(`DROP TABLE IF EXISTS users CASCADE`)

	DB.Exec(`
		CREATE TABLE users (
			id SERIAL PRIMARY KEY,
			email VARCHAR(255) UNIQUE NOT NULL,
			password VARCHAR(255) NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)
	`)

	DB.Exec(`
		CREATE TABLE markers (
			id SERIAL PRIMARY KEY,
			user_id INTEGER REFERENCES users(id),
			text TEXT NOT NULL,
			description TEXT,
			latitude DECIMAL(10, 8) NOT NULL,
			longitude DECIMAL(11, 8) NOT NULL,
			image_url TEXT,
			category VARCHAR(100),
			status VARCHAR(50) DEFAULT 'pending',
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)
	`)

	hashedPassword, _ := bcrypt.GenerateFromPassword([]byte("admin123"), 14)
	DB.Exec("INSERT INTO users (email, password) VALUES ($1, $2)", "admin@test.com", string(hashedPassword))
	log.Println("Test user created: admin@test.com / admin123")
}
