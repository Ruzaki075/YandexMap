package database

import (
	"database/sql"
	"log"
	"os"
	"time"

	_ "github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
)

var DB *sql.DB

func ConnectDB() {
	connStr := os.Getenv("DATABASE_URL")
	autoCreateDB := false
	if connStr == "" {
		connStr = "host=localhost port=5432 user=postgres password=Chernig007or dbname=yandexmap sslmode=disable"
		autoCreateDB = true
	}

	var err error
	DB, err = sql.Open("postgres", connStr)
	if err != nil {
		log.Fatal("Failed to open DB:", err)
	}

	DB.SetMaxOpenConns(25)
	DB.SetMaxIdleConns(25)
	DB.SetConnMaxLifetime(5 * time.Minute)

	if err = DB.Ping(); err != nil {
		if autoCreateDB {
			admin, e2 := sql.Open("postgres", "host=localhost port=5432 user=postgres password=Chernig007or dbname=postgres sslmode=disable")
			if e2 == nil {
				_, _ = admin.Exec("CREATE DATABASE yandexmap")
				admin.Close()
			}
			err = DB.Ping()
		}
		if err != nil {
			log.Fatal("Failed to ping DB:", err)
		}
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
			domain_key VARCHAR(80),
			group_key VARCHAR(80),
			issue_key VARCHAR(80),
			ai_confidence DOUBLE PRECISION,
			status VARCHAR(50) DEFAULT 'pending',
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)
	`)

	hashedPassword, _ := bcrypt.GenerateFromPassword([]byte("admin123"), 14)
	DB.Exec("INSERT INTO users (email, password) VALUES ($1, $2)", "admin@test.com", string(hashedPassword))
	log.Println("Test user created: admin@test.com / admin123")
}
