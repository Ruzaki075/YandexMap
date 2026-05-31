ALTER TABLE markers ADD COLUMN IF NOT EXISTS image_after_url TEXT;

ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(120);
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT '';

CREATE TABLE IF NOT EXISTS marker_favorites (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    marker_id INTEGER NOT NULL REFERENCES markers(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, marker_id)
);
CREATE INDEX IF NOT EXISTS idx_marker_favorites_user ON marker_favorites(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS marker_change_log (
    id SERIAL PRIMARY KEY,
    marker_id INTEGER NOT NULL REFERENCES markers(id) ON DELETE CASCADE,
    field_name VARCHAR(64) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_marker_change_log_marker ON marker_change_log(marker_id, created_at DESC);

CREATE TABLE IF NOT EXISTS admin_audit_log (
    id SERIAL PRIMARY KEY,
    actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(64) NOT NULL,
    target_type VARCHAR(32) NOT NULL,
    target_id INTEGER,
    details JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_log(created_at DESC);

CREATE TABLE IF NOT EXISTS abuse_reports (
    id SERIAL PRIMARY KEY,
    reporter_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type VARCHAR(32) NOT NULL,
    target_id INTEGER NOT NULL,
    reason VARCHAR(64) NOT NULL,
    details TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_abuse_reports_status ON abuse_reports(status, created_at DESC);
