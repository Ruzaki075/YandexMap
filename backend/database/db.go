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
	RunMigrations()
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

	exec(`
		CREATE TABLE IF NOT EXISTS classification_domains (
			domain_key VARCHAR(80) PRIMARY KEY,
			label_ru VARCHAR(255) NOT NULL,
			marker_icon VARCHAR(64) NOT NULL DEFAULT 'islands#grayIcon',
			training_phrases JSONB NOT NULL DEFAULT '[]',
			resolution_days INTEGER NOT NULL DEFAULT 14,
			sort_order INTEGER NOT NULL DEFAULT 0,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)
	`)
	exec(`ALTER TABLE classification_domains ADD COLUMN IF NOT EXISTS resolution_days INTEGER NOT NULL DEFAULT 14`)

	exec(`ALTER TABLE markers ADD COLUMN IF NOT EXISTS response_due_at TIMESTAMP`)
	exec(`ALTER TABLE markers ADD COLUMN IF NOT EXISTS resolution_due_at TIMESTAMP`)
	exec(`ALTER TABLE markers ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP`)
	exec(`ALTER TABLE markers ADD COLUMN IF NOT EXISTS address_text TEXT`)
	exec(`ALTER TABLE markers ADD COLUMN IF NOT EXISTS image_after_url TEXT`)

	exec(`
		CREATE TABLE IF NOT EXISTS comments (
			id SERIAL PRIMARY KEY,
			user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			marker_id INTEGER NOT NULL REFERENCES markers(id) ON DELETE CASCADE,
			text TEXT NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)
	`)
	exec(`CREATE INDEX IF NOT EXISTS idx_comments_marker_id ON comments(marker_id)`)

	exec(`ALTER TABLE users ADD COLUMN IF NOT EXISTS karma_points INTEGER NOT NULL DEFAULT 0`)
	exec(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT`)
	exec(`ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(120)`)
	exec(`ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT ''`)

	exec(`
		CREATE TABLE IF NOT EXISTS marker_supports (
			id SERIAL PRIMARY KEY,
			marker_id INTEGER NOT NULL REFERENCES markers(id) ON DELETE CASCADE,
			user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(marker_id, user_id)
		)
	`)
	exec(`CREATE INDEX IF NOT EXISTS idx_marker_supports_marker ON marker_supports(marker_id)`)

	exec(`
		CREATE TABLE IF NOT EXISTS abuse_reports (
			id SERIAL PRIMARY KEY,
			reporter_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			target_type VARCHAR(32) NOT NULL,
			target_id INTEGER NOT NULL,
			reason VARCHAR(64) NOT NULL,
			details TEXT,
			status VARCHAR(20) NOT NULL DEFAULT 'open',
			created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
		)
	`)
	exec(`CREATE INDEX IF NOT EXISTS idx_abuse_reports_status ON abuse_reports(status, created_at DESC)`)

	exec(`
		CREATE TABLE IF NOT EXISTS geo_subscriptions (
			id SERIAL PRIMARY KEY,
			user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			label VARCHAR(120) DEFAULT '',
			latitude DECIMAL(10, 8) NOT NULL,
			longitude DECIMAL(11, 8) NOT NULL,
			radius_m INTEGER NOT NULL DEFAULT 500,
			notify_new BOOLEAN NOT NULL DEFAULT TRUE,
			notify_resolved BOOLEAN NOT NULL DEFAULT TRUE,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)
	`)
	exec(`CREATE INDEX IF NOT EXISTS idx_geo_subscriptions_user ON geo_subscriptions(user_id)`)

	exec(`
		CREATE TABLE IF NOT EXISTS marker_status_log (
			id SERIAL PRIMARY KEY,
			marker_id INTEGER NOT NULL REFERENCES markers(id) ON DELETE CASCADE,
			old_status VARCHAR(50),
			new_status VARCHAR(50) NOT NULL,
			actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
			moderator_note TEXT,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)
	`)
	exec(`CREATE INDEX IF NOT EXISTS idx_marker_status_log_marker ON marker_status_log(marker_id, created_at DESC)`)

	exec(`
		UPDATE markers SET response_due_at = created_at + INTERVAL '3 days'
		WHERE response_due_at IS NULL AND LOWER(COALESCE(status, 'pending')) = 'pending'
	`)
	exec(`
		UPDATE markers m SET resolution_due_at = COALESCE(m.updated_at, m.created_at) + (COALESCE(c.resolution_days, 14) || ' days')::interval
		FROM classification_domains c
		WHERE m.domain_key = c.domain_key
		  AND LOWER(COALESCE(m.status, 'pending')) IN ('approved', 'in_progress')
		  AND m.resolution_due_at IS NULL
	`)
	exec(`
		UPDATE markers SET resolved_at = updated_at
		WHERE resolved_at IS NULL AND LOWER(COALESCE(status, 'pending')) = 'resolved'
	`)
	exec(`UPDATE classification_domains SET resolution_days = 14 WHERE domain_key = 'roads'`)
	exec(`UPDATE classification_domains SET resolution_days = 21 WHERE domain_key = 'transit'`)
	exec(`UPDATE classification_domains SET resolution_days = 14 WHERE domain_key = 'pedestrian'`)
	exec(`UPDATE classification_domains SET resolution_days = 30 WHERE domain_key = 'utilities'`)
	exec(`UPDATE classification_domains SET resolution_days = 45 WHERE domain_key = 'social'`)

	seedDefaultAdmin()
}

func seedDefaultAdmin() {
	var n int
	if err := DB.QueryRow(`SELECT COUNT(*) FROM users WHERE LOWER(TRIM(email)) = LOWER($1)`, "admin@test.com").Scan(&n); err != nil {
		log.Printf("seed admin check: %v", err)
		return
	}
	if n == 0 {
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
	// Учётка могла появиться через регистрацию без прав — при старте всегда даём модератора+админа.
	if _, err := DB.Exec(
		`UPDATE users SET is_moderator = TRUE, is_admin = TRUE WHERE LOWER(TRIM(email)) = LOWER($1)`,
		"admin@test.com",
	); err != nil {
		log.Printf("ensure admin@test.com roles: %v", err)
	}
}
