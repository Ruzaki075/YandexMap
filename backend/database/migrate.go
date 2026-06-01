package database

import (
	"embed"
	"fmt"
	"log"
	"sort"
	"strconv"
	"strings"
)

//go:embed migrations/*.up.sql
var migrationFiles embed.FS

// RunMigrations applies numbered *.up.sql files once (production-style).
func RunMigrations() {
	entries, err := migrationFiles.ReadDir("migrations")
	if err != nil {
		log.Printf("migrations: read dir: %v", err)
		return
	}
	var versions []int
	files := map[int]string{}
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".up.sql") {
			continue
		}
		prefix := strings.SplitN(e.Name(), "_", 2)[0]
		v, err := strconv.Atoi(prefix)
		if err != nil {
			continue
		}
		versions = append(versions, v)
		files[v] = e.Name()
	}
	sort.Ints(versions)

	for _, v := range versions {
		var applied bool
		_ = DB.QueryRow(`SELECT true FROM schema_migrations WHERE version = $1`, v).Scan(&applied)
		if applied {
			continue
		}
		body, err := migrationFiles.ReadFile("migrations/" + files[v])
		if err != nil {
			log.Printf("migration %d: read: %v", v, err)
			continue
		}
		if _, err := DB.Exec(string(body)); err != nil {
			log.Printf("migration %d (%s): %v", v, files[v], err)
			continue
		}
		if _, err := DB.Exec(`INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING`, v); err != nil {
			log.Printf("migration %d record: %v", v, err)
		} else {
			log.Printf("Applied migration %d: %s", v, files[v])
		}
	}
}

// SyncMarkerLocation updates PostGIS point from lat/lng (no-op if column missing).
func SyncMarkerLocation(markerID int, lat, lng float64) {
	_, _ = DB.Exec(`
		UPDATE markers SET
			location = ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography,
			latitude = $2,
			longitude = $3
		WHERE id = $1`,
		markerID, lat, lng,
	)
}

// PostGISAvailable returns true if postgis extension is installed.
func PostGISAvailable() bool {
	var ok bool
	err := DB.QueryRow(`SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'postgis')`).Scan(&ok)
	return err == nil && ok
}

func NearbyMarkersPostGIS(lat, lng float64, radiusM int, limit int) ([]int, error) {
	if !PostGISAvailable() {
		return nil, fmt.Errorf("postgis unavailable")
	}
	if limit < 1 {
		limit = 10
	}
	rows, err := DB.Query(`
		SELECT id FROM markers
		WHERE location IS NOT NULL
		  AND ST_DWithin(
		    location,
		    ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
		    $3
		  )
		ORDER BY ST_Distance(location, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography)
		LIMIT $4`,
		lat, lng, radiusM, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []int
	for rows.Next() {
		var id int
		if err := rows.Scan(&id); err == nil {
			ids = append(ids, id)
		}
	}
	return ids, nil
}
