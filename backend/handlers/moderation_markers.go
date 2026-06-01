package handlers

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"backend/database"
	"backend/middleware"
	"backend/repositories"
)

func requireModerator(w http.ResponseWriter, r *http.Request) bool {
	if middleware.GetIsModeratorFromContext(r.Context()) || middleware.GetIsAdminFromContext(r.Context()) {
		return true
	}
	uid, ok := middleware.GetUserIDFromContext(r.Context())
	if ok && database.DB != nil {
		var isMod, isAdmin bool
		if err := database.DB.QueryRow(
			`SELECT COALESCE(is_moderator, FALSE), COALESCE(is_admin, FALSE) FROM users WHERE id = $1`,
			uid,
		).Scan(&isMod, &isAdmin); err == nil && (isMod || isAdmin) {
			return true
		}
	}
	respondWithError(w, http.StatusForbidden, "Moderator or admin only")
	return false
}

// ListModerationMarkersHandler GET /api/moderation/markers
func ListModerationMarkersHandler(w http.ResponseWriter, r *http.Request) {
	if !requireModerator(w, r) {
		return
	}

	q := r.URL.Query()
	page, _ := strconv.Atoi(q.Get("page"))
	pageSize, _ := strconv.Atoi(q.Get("page_size"))
	if pageSize == 0 {
		pageSize, _ = strconv.Atoi(q.Get("limit"))
	}

	moderatorUID, _ := middleware.GetUserIDFromContext(r.Context())

	domainKey := strings.TrimSpace(q.Get("category"))
	if domainKey == "" {
		domainKey = strings.TrimSpace(q.Get("domain_key"))
	}

	listQ := repositories.ModerationListQuery{
		Page:         page,
		PageSize:     pageSize,
		Status:       strings.TrimSpace(q.Get("status")),
		DomainKey:    domainKey,
		Overdue:      q.Get("overdue") == "1" || strings.EqualFold(q.Get("overdue"), "true"),
		HasPhoto:     q.Get("has_photo") == "1",
		Unresolved:   q.Get("unresolved") == "1",
		MyChecks:     q.Get("my_checks") == "1",
		ModeratorUID: moderatorUID,
		Search:       strings.TrimSpace(q.Get("q")),
		Sort:         strings.TrimSpace(q.Get("sort")),
	}

	if n, err := strconv.Atoi(q.Get("supports_min")); err == nil && n > 0 {
		listQ.MinSupports = n
	}
	if listQ.MinSupports == 0 && (q.Get("many_supports") == "1" || q.Get("hot") == "1") {
		listQ.MinSupports = 3
	}

	if df := strings.TrimSpace(q.Get("date_from")); df != "" {
		if t, err := time.Parse("2006-01-02", df); err == nil {
			listQ.DateFrom = &t
		}
	}
	if dt := strings.TrimSpace(q.Get("date_to")); dt != "" {
		if t, err := time.Parse("2006-01-02", dt); err == nil {
			end := t.Add(24 * time.Hour)
			listQ.DateTo = &end
		}
	}

	markers, total, err := repositories.ListModerationMarkers(listQ)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"status":    "success",
		"markers":   markers,
		"total":     total,
		"page":      listQ.Page,
		"page_size": listQ.PageSize,
		"count":     len(markers),
	})
}
