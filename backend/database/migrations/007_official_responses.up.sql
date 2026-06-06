-- Официальные ответы ведомств

CREATE TABLE IF NOT EXISTS departments (
  id SERIAL PRIMARY KEY,
  name_ru VARCHAR(200) NOT NULL,
  short_name VARCHAR(50),
  category_keys TEXT[],
  contact_email VARCHAR(200),
  icon VARCHAR(10),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS official_responses (
  id SERIAL PRIMARY KEY,
  marker_id INTEGER NOT NULL REFERENCES markers(id) ON DELETE CASCADE,
  department_id INTEGER NOT NULL REFERENCES departments(id),
  responded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  response_text TEXT NOT NULL,
  response_type VARCHAR(30) NOT NULL DEFAULT 'info_requested',
  planned_date DATE,
  actual_date DATE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_official_responses_marker ON official_responses(marker_id);

ALTER TABLE users ADD COLUMN IF NOT EXISTS department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_department_rep BOOLEAN NOT NULL DEFAULT FALSE;

INSERT INTO departments (name_ru, short_name, category_keys, icon)
SELECT v.name_ru, v.short_name, v.category_keys, v.icon
FROM (VALUES
  ('Департамент дорожной инфраструктуры', 'ДДИ', ARRAY['roads']::text[], '🛣️'),
  ('Комитет городского транспорта', 'КГТ', ARRAY['transit']::text[], '🚌'),
  ('Управление благоустройства', 'УБ', ARRAY['pedestrian', 'social']::text[], '🌳'),
  ('Городские коммунальные службы', 'ГКС', ARRAY['utilities']::text[], '⚡')
) AS v(name_ru, short_name, category_keys, icon)
WHERE NOT EXISTS (SELECT 1 FROM departments LIMIT 1);
