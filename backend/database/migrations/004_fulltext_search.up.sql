ALTER TABLE markers ADD COLUMN IF NOT EXISTS search_vector tsvector;

UPDATE markers SET search_vector =
    setweight(to_tsvector('russian', COALESCE(text, '')), 'A')
WHERE search_vector IS NULL;

CREATE INDEX IF NOT EXISTS idx_markers_search ON markers USING GIN (search_vector);

CREATE OR REPLACE FUNCTION markers_search_vector_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('russian', COALESCE(NEW.text, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(NEW.address_text, '')), 'B');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS markers_search_vector_update ON markers;
CREATE TRIGGER markers_search_vector_update
BEFORE INSERT OR UPDATE OF text, address_text ON markers
FOR EACH ROW EXECUTE FUNCTION markers_search_vector_trigger();
