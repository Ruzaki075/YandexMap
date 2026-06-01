-- PostGIS is optional; address_text is ensured in migrateSchema() for hosts without PostGIS.
CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE markers ADD COLUMN IF NOT EXISTS location geography(POINT, 4326);

UPDATE markers
SET location = ST_SetSRID(ST_MakePoint(longitude::float8, latitude::float8), 4326)::geography
WHERE location IS NULL AND latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_markers_location ON markers USING GIST (location);

ALTER TABLE geo_subscriptions ADD COLUMN IF NOT EXISTS location geography(POINT, 4326);

UPDATE geo_subscriptions
SET location = ST_SetSRID(ST_MakePoint(longitude::float8, latitude::float8), 4326)::geography
WHERE location IS NULL;

CREATE INDEX IF NOT EXISTS idx_geo_subscriptions_location ON geo_subscriptions USING GIST (location);
