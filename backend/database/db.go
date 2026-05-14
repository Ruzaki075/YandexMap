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

	migrateSchema()
	log.Println("PostgreSQL connected")
}

func migrateSchema() {
	exec := func(q string) {
		if _, err := DB.Exec(q); err != nil {
			log.Printf("migration: %v", err)
		}
	}

	exec(`
		CREATE TABLE IF NOT EXISTS users (
			id SERIAL PRIMARY KEY,
			email VARCHAR(255) UNIQUE NOT NULL,
			password VARCHAR(255) NOT NULL,
			is_moderator BOOLEAN NOT NULL DEFAULT FALSE,
			is_admin BOOLEAN NOT NULL DEFAULT FALSE,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)
	`)
	exec(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_moderator BOOLEAN NOT NULL DEFAULT FALSE`)
	exec(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE`)
	exec(`ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`)

	exec(`
		CREATE TABLE IF NOT EXISTS markers (
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
			moderator_note TEXT,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)
	`)
	exec(`ALTER TABLE markers ADD COLUMN IF NOT EXISTS domain_key VARCHAR(80)`)
	exec(`ALTER TABLE markers ADD COLUMN IF NOT EXISTS group_key VARCHAR(80)`)
	exec(`ALTER TABLE markers ADD COLUMN IF NOT EXISTS issue_key VARCHAR(80)`)
	exec(`ALTER TABLE markers ADD COLUMN IF NOT EXISTS ai_confidence DOUBLE PRECISION`)
	exec(`ALTER TABLE markers ADD COLUMN IF NOT EXISTS moderator_note TEXT`)

	exec(`
		CREATE TABLE IF NOT EXISTS marker_reviews (
			id SERIAL PRIMARY KEY,
			marker_id INTEGER NOT NULL REFERENCES markers(id) ON DELETE CASCADE,
			user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
			comment TEXT,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(marker_id, user_id)
		)
	`)
	exec(`CREATE INDEX IF NOT EXISTS idx_marker_reviews_marker_id ON marker_reviews(marker_id)`)

	exec(`
		CREATE TABLE IF NOT EXISTS notifications (
			id SERIAL PRIMARY KEY,
			user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			notif_type VARCHAR(40) NOT NULL,
			marker_id INTEGER REFERENCES markers(id) ON DELETE SET NULL,
			title VARCHAR(255) NOT NULL,
			body TEXT,
			read_at TIMESTAMP,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)
	`)
	exec(`
		DO $mv$
		BEGIN
			IF EXISTS (
				SELECT 1 FROM information_schema.columns
				WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'type'
			) THEN
				ALTER TABLE notifications RENAME COLUMN type TO notif_type;
			END IF;
		END
		$mv$;
	`)
	exec(`CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC)`)

	seedDefaultAdmin()
}

func seedDefaultAdmin() {
	var n int
	if err := DB.QueryRow(`SELECT COUNT(*) FROM users WHERE email = $1`, "admin@test.com").Scan(&n); err != nil {
		log.Printf("seed admin check: %v", err)
		return
	}
	if n > 0 {
		return
	}
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte("admin123"), 14)
	if err != nil {
		log.Printf("seed admin bcrypt: %v", err)
		return
	}
	if _, err := DB.Exec(
		`INSERT INTO users (email, password, is_moderator, is_admin) VALUES ($1, $2, TRUE, TRUE)`,
		"admin@test.com", string(hashedPassword),
	); err != nil {
		log.Printf("seed admin insert: %v", err)
		return
	}
	log.Println("Создан тестовый администратор: admin@test.com / admin123")
}
