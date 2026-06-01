-- Городские опросы / голосования

CREATE TABLE IF NOT EXISTS polls (
  id SERIAL PRIMARY KEY,
  title_ru VARCHAR(300) NOT NULL,
  description_ru TEXT,
  category_key VARCHAR(50),
  district VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  poll_type VARCHAR(20) NOT NULL DEFAULT 'single',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  starts_at TIMESTAMP NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMP,
  show_results_before_vote BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_polls_status ON polls(status, ends_at);

CREATE TABLE IF NOT EXISTS poll_options (
  id SERIAL PRIMARY KEY,
  poll_id INTEGER NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  text_ru VARCHAR(500) NOT NULL,
  votes_count INTEGER NOT NULL DEFAULT 0,
  order_num INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_poll_options_poll ON poll_options(poll_id, order_num);

CREATE TABLE IF NOT EXISTS poll_votes (
  id SERIAL PRIMARY KEY,
  poll_id INTEGER NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  option_id INTEGER NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(poll_id, user_id)
);
