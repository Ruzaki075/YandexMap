package repositories

import (
	"database/sql"
	"encoding/json"
	"errors"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	"backend/database"
	"backend/models"
)

var domainKeyRe = regexp.MustCompile(`^[a-z][a-z0-9_]{0,62}$`)

var allowedMarkerIcons = map[string]bool{
	"islands#redIcon":       true,
	"islands#blueIcon":      true,
	"islands#greenIcon":     true,
	"islands#orangeIcon":    true,
	"islands#violetIcon":    true,
	"islands#darkBlueIcon":  true,
	"islands#pinkIcon":      true,
	"islands#grayIcon":      true,
	"islands#yellowIcon":    true,
	"islands#brownIcon":     true,
	"islands#oliveIcon":     true,
	"islands#nightIcon":     true,
}

var defaultSeedIcons = []string{
	"islands#redIcon",
	"islands#blueIcon",
	"islands#greenIcon",
	"islands#orangeIcon",
	"islands#violetIcon",
}

func TaxonomyFilePath() string {
	if p := strings.TrimSpace(os.Getenv("TAXONOMY_PATH")); p != "" {
		return p
	}
	for _, p := range []string{
		"../issue-taxonomy.json",
		"issue-taxonomy.json",
		filepath.Join("..", "issue-taxonomy.json"),
	} {
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	return "../issue-taxonomy.json"
}

func NormalizeMarkerIcon(icon string) string {
	icon = strings.TrimSpace(icon)
	if allowedMarkerIcons[icon] {
		return icon
	}
	return "islands#grayIcon"
}

func ValidateDomainKey(key string) error {
	key = strings.TrimSpace(key)
	if !domainKeyRe.MatchString(key) {
		return errors.New("Ключ: латиница, цифры и _, начинается с буквы (до 63 символов)")
	}
	return nil
}

func SeedClassificationsIfEmpty() {
	var n int
	if err := database.DB.QueryRow(`SELECT COUNT(*) FROM classification_domains`).Scan(&n); err != nil {
		log.Printf("classification seed check: %v", err)
		return
	}
	if n > 0 {
		return
	}
	path := TaxonomyFilePath()
	raw, err := os.ReadFile(path)
	if err != nil {
		log.Printf("classification seed read file: %v", err)
		return
	}
	var tax models.Taxonomy
	if err := json.Unmarshal(raw, &tax); err != nil {
		log.Printf("classification seed parse: %v", err)
		return
	}
	for i, d := range tax.Domains {
		icon := strings.TrimSpace(d.MarkerIcon)
		if icon == "" && i < len(defaultSeedIcons) {
			icon = defaultSeedIcons[i]
		}
		if icon == "" {
			icon = defaultSeedIcons[i%len(defaultSeedIcons)]
		}
		phrases, _ := json.Marshal(d.TrainingPhrasesRu)
		if phrases == nil {
			phrases = []byte("[]")
		}
		resDays := d.ResolutionDays
		if resDays < 1 {
			if rd, ok := seedResolutionDays[d.Key]; ok {
				resDays = rd
			} else {
				resDays = DefaultResolutionDays
			}
		}
		_, err := database.DB.Exec(
			`INSERT INTO classification_domains (domain_key, label_ru, marker_icon, training_phrases, resolution_days, sort_order)
			 VALUES ($1, $2, $3, $4::jsonb, $5, $6)
			 ON CONFLICT (domain_key) DO NOTHING`,
			d.Key, d.LabelRu, NormalizeMarkerIcon(icon), string(phrases), resDays, i,
		)
		if err != nil {
			log.Printf("classification seed insert %s: %v", d.Key, err)
		}
	}
	log.Println("Классификации загружены из issue-taxonomy.json")
	_ = SyncTaxonomyFile()
}

func ListTaxonomy() (*models.Taxonomy, error) {
	rows, err := database.DB.Query(`
		SELECT domain_key, label_ru, marker_icon, training_phrases, resolution_days, sort_order
		FROM classification_domains
		ORDER BY sort_order ASC, domain_key ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tax := &models.Taxonomy{
		Version:       2,
		DescriptionRu: "Одно направление на обращение — внутри могут быть любые детали, не укладывающиеся в жёсткие подтипы.",
		Domains:       []models.TaxonomyDomain{},
	}
	for rows.Next() {
		var key, label, icon string
		var phrasesJSON []byte
		var resDays, sortOrder int
		if err := rows.Scan(&key, &label, &icon, &phrasesJSON, &resDays, &sortOrder); err != nil {
			continue
		}
		var phrases []string
		_ = json.Unmarshal(phrasesJSON, &phrases)
		tax.Domains = append(tax.Domains, models.TaxonomyDomain{
			Key:               key,
			LabelRu:           label,
			MarkerIcon:        icon,
			ResolutionDays:    resDays,
			TrainingPhrasesRu: phrases,
		})
	}
	return tax, nil
}

func ListAdminClassifications() ([]models.AdminClassificationRow, error) {
	rows, err := database.DB.Query(`
		SELECT c.domain_key, c.label_ru, c.marker_icon, c.resolution_days, c.sort_order, c.training_phrases,
			COUNT(m.id)::int,
			COUNT(*) FILTER (WHERE LOWER(COALESCE(m.status, '')) = 'resolved')::int,
			COUNT(*) FILTER (WHERE
				(LOWER(COALESCE(m.status, '')) = 'pending'
					AND m.response_due_at IS NOT NULL AND m.response_due_at < NOW())
				OR (LOWER(COALESCE(m.status, '')) IN ('approved', 'in_progress')
					AND m.resolution_due_at IS NOT NULL AND m.resolution_due_at < NOW())
			)::int,
			AVG(EXTRACT(EPOCH FROM (m.resolved_at - m.created_at)) / 86400.0)
				FILTER (WHERE m.resolved_at IS NOT NULL)
		FROM classification_domains c
		LEFT JOIN markers m ON m.domain_key = c.domain_key
		GROUP BY c.domain_key, c.label_ru, c.marker_icon, c.resolution_days, c.sort_order, c.training_phrases
		ORDER BY c.sort_order ASC, c.domain_key ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []models.AdminClassificationRow
	for rows.Next() {
		var row models.AdminClassificationRow
		var avgDays sql.NullFloat64
		var phrasesJSON []byte
		if err := rows.Scan(
			&row.Key, &row.LabelRu, &row.MarkerIcon, &row.ResolutionDays, &row.SortOrder, &phrasesJSON,
			&row.MarkersCount, &row.ResolvedCount, &row.OverdueCount, &avgDays,
		); err != nil {
			continue
		}
		_ = json.Unmarshal(phrasesJSON, &row.TrainingPhrasesRu)
		if row.MarkersCount > 0 {
			row.ResolvedPct = float64(row.ResolvedCount) * 100 / float64(row.MarkersCount)
		}
		if avgDays.Valid && avgDays.Float64 >= 0 {
			v := avgDays.Float64
			row.AvgResolutionDays = &v
		}
		list = append(list, row)
	}
	return list, nil
}

func ReorderClassifications(keys []string) error {
	if len(keys) == 0 {
		return errors.New("Пустой порядок")
	}
	tx, err := database.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	for i, key := range keys {
		key = strings.TrimSpace(key)
		if key == "" {
			continue
		}
		if _, err := tx.Exec(
			`UPDATE classification_domains SET sort_order = $1 WHERE domain_key = $2`,
			i, key,
		); err != nil {
			return err
		}
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	return SyncTaxonomyFile()
}

func nextSortOrder() (int, error) {
	var n sql.NullInt64
	err := database.DB.QueryRow(`SELECT COALESCE(MAX(sort_order), -1) + 1 FROM classification_domains`).Scan(&n)
	if err != nil {
		return 0, err
	}
	return int(n.Int64), nil
}

func CreateClassification(req models.CreateClassificationRequest) error {
	key := strings.TrimSpace(req.Key)
	label := strings.TrimSpace(req.LabelRu)
	if label == "" {
		return errors.New("Укажите название классификации")
	}
	if err := ValidateDomainKey(key); err != nil {
		return err
	}
	icon := NormalizeMarkerIcon(req.MarkerIcon)
	if req.MarkerIcon == "" {
		order, _ := nextSortOrder()
		icon = defaultSeedIcons[order%len(defaultSeedIcons)]
	}
	phrases, _ := json.Marshal(req.TrainingPhrasesRu)
	if phrases == nil {
		phrases = []byte("[]")
	}
	resDays := req.ResolutionDays
	if resDays < 1 {
		resDays = DefaultResolutionDays
	}
	sortOrder, err := nextSortOrder()
	if err != nil {
		return err
	}
	res, err := database.DB.Exec(
		`INSERT INTO classification_domains (domain_key, label_ru, marker_icon, training_phrases, resolution_days, sort_order)
		 VALUES ($1, $2, $3, $4::jsonb, $5, $6)`,
		key, label, icon, string(phrases), resDays, sortOrder,
	)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate") || strings.Contains(err.Error(), "unique") {
			return errors.New("Классификация с таким ключом уже существует")
		}
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return errors.New("Не удалось создать классификацию")
	}
	return SyncTaxonomyFile()
}

func UpdateClassification(key string, req models.UpdateClassificationRequest) error {
	key = strings.TrimSpace(key)
	var sets []string
	var args []interface{}
	n := 1
	if req.LabelRu != nil {
		label := strings.TrimSpace(*req.LabelRu)
		if label == "" {
			return errors.New("Название не может быть пустым")
		}
		sets = append(sets, "label_ru = $"+itoa(n))
		args = append(args, label)
		n++
	}
	if req.MarkerIcon != nil {
		sets = append(sets, "marker_icon = $"+itoa(n))
		args = append(args, NormalizeMarkerIcon(*req.MarkerIcon))
		n++
	}
	if req.TrainingPhrasesRu != nil {
		phrases, _ := json.Marshal(req.TrainingPhrasesRu)
		sets = append(sets, "training_phrases = $"+itoa(n)+"::jsonb")
		args = append(args, string(phrases))
		n++
	}
	if req.ResolutionDays != nil && *req.ResolutionDays > 0 {
		sets = append(sets, "resolution_days = $"+itoa(n))
		args = append(args, *req.ResolutionDays)
		n++
	}
	if req.SortOrder != nil && *req.SortOrder >= 0 {
		sets = append(sets, "sort_order = $"+itoa(n))
		args = append(args, *req.SortOrder)
		n++
	}
	if len(sets) == 0 {
		return errors.New("Нечего обновлять")
	}
	args = append(args, key)
	q := `UPDATE classification_domains SET ` + strings.Join(sets, ", ") + ` WHERE domain_key = $` + itoa(n)
	res, err := database.DB.Exec(q, args...)
	if err != nil {
		return err
	}
	aff, _ := res.RowsAffected()
	if aff == 0 {
		return sql.ErrNoRows
	}
	return SyncTaxonomyFile()
}

func DeleteClassification(key string) error {
	key = strings.TrimSpace(key)
	var cnt int
	if err := database.DB.QueryRow(
		`SELECT COUNT(*) FROM markers WHERE domain_key = $1`, key,
	).Scan(&cnt); err != nil {
		return err
	}
	if cnt > 0 {
		return errors.New("Нельзя удалить: есть обращения с этой классификацией")
	}
	res, err := database.DB.Exec(`DELETE FROM classification_domains WHERE domain_key = $1`, key)
	if err != nil {
		return err
	}
	aff, _ := res.RowsAffected()
	if aff == 0 {
		return sql.ErrNoRows
	}
	return SyncTaxonomyFile()
}

func AllowedMarkerIconsList() []string {
	return []string{
		"islands#redIcon",
		"islands#blueIcon",
		"islands#greenIcon",
		"islands#orangeIcon",
		"islands#violetIcon",
		"islands#darkBlueIcon",
		"islands#pinkIcon",
		"islands#grayIcon",
		"islands#yellowIcon",
		"islands#brownIcon",
		"islands#oliveIcon",
		"islands#nightIcon",
	}
}

func SyncTaxonomyFile() error {
	tax, err := ListTaxonomy()
	if err != nil {
		return err
	}
	raw, err := json.MarshalIndent(tax, "", "  ")
	if err != nil {
		return err
	}
	path := TaxonomyFilePath()
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil && filepath.Dir(path) != "." {
		// ignore
	}
	return os.WriteFile(path, raw, 0644)
}

func itoa(n int) string {
	return strconv.Itoa(n)
}
