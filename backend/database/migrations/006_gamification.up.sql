-- Геймификация: баллы, достижения, streak входа

CREATE TABLE IF NOT EXISTS user_points (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  points INTEGER NOT NULL DEFAULT 0,
  total_earned INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS points_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  points INTEGER NOT NULL,
  description TEXT,
  marker_id INTEGER REFERENCES markers(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_points_log_user ON points_log(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS achievements (
  id SERIAL PRIMARY KEY,
  key VARCHAR(50) UNIQUE NOT NULL,
  name_ru VARCHAR(100) NOT NULL,
  description_ru TEXT,
  icon VARCHAR(10),
  points_reward INTEGER NOT NULL DEFAULT 0,
  condition_type VARCHAR(50) NOT NULL,
  condition_value INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS user_achievements (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id INTEGER NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  earned_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS login_streak INTEGER NOT NULL DEFAULT 0;

INSERT INTO achievements (key, name_ru, description_ru, icon, points_reward, condition_type, condition_value) VALUES
('first_marker', 'Первое обращение', 'Подали первое обращение', '📍', 50, 'markers_count', 1),
('marker_5', 'Активный житель', '5 обращений подано', '🏘️', 100, 'markers_count', 5),
('marker_20', 'Городской активист', '20 обращений подано', '⭐', 300, 'markers_count', 20),
('first_resolved', 'Проблема решена!', 'Первое обращение решено', '✅', 200, 'resolved_count', 1),
('resolved_5', 'Меняю город', '5 обращений решено', '🏆', 500, 'resolved_count', 5),
('streak_7', 'Неделя активности', '7 дней подряд на платформе', '🔥', 150, 'streak_days', 7),
('votes_10', 'Голос города', 'Участие в 10 голосованиях', '🗳️', 100, 'votes_count', 10)
ON CONFLICT (key) DO NOTHING;
