-- Индексы для панели модерации (фильтры, сортировки, SLA)

CREATE INDEX IF NOT EXISTS idx_markers_status_created
  ON markers (LOWER(COALESCE(NULLIF(TRIM(status), ''), 'pending')), created_at DESC);

CREATE INDEX IF NOT EXISTS idx_markers_domain_key
  ON markers (domain_key)
  WHERE domain_key IS NOT NULL AND TRIM(domain_key) <> '';

CREATE INDEX IF NOT EXISTS idx_markers_response_due
  ON markers (response_due_at)
  WHERE response_due_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_markers_resolution_due
  ON markers (resolution_due_at)
  WHERE resolution_due_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_markers_updated_at
  ON markers (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_marker_status_log_actor
  ON marker_status_log (actor_user_id, created_at DESC);
