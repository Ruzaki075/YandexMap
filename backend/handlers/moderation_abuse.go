package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"backend/repositories"
	"github.com/gorilla/mux"
)

// ListModerationAbuseReportsHandler GET /api/moderation/abuse-reports
func ListModerationAbuseReportsHandler(w http.ResponseWriter, r *http.Request) {
	if !requireModerator(w, r) {
		return
	}
	q := r.URL.Query()
	page, _ := strconv.Atoi(q.Get("page"))
	if page < 1 {
		page = 1
	}
	pageSize, _ := strconv.Atoi(q.Get("page_size"))
	if pageSize == 0 {
		pageSize, _ = strconv.Atoi(q.Get("limit"))
	}
	status := q.Get("status")
	if status == "" {
		status = "open"
	}
	list, total, err := repositories.ListAbuseReports(repositories.AbuseListQuery{
		Page:     page,
		PageSize: pageSize,
		Status:   status,
		Reason:   q.Get("reason"),
	})
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}
	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"status":  "success",
		"reports": list,
		"total":   total,
		"page":    page,
	})
}

// PatchModerationAbuseReportHandler PATCH /api/moderation/abuse-reports/{id}
func PatchModerationAbuseReportHandler(w http.ResponseWriter, r *http.Request) {
	if !requireModerator(w, r) {
		return
	}
	id, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil || id <= 0 {
		respondWithError(w, http.StatusBadRequest, "Invalid id")
		return
	}
	var body struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid JSON")
		return
	}
	if err := repositories.UpdateAbuseReportStatus(id, body.Status); err != nil {
		if err.Error() == "invalid status" {
			respondWithError(w, http.StatusBadRequest, "status must be dismissed or actioned")
			return
		}
		respondWithError(w, http.StatusNotFound, "Report not found")
		return
	}
	respondWithJSON(w, http.StatusOK, map[string]interface{}{"status": "success", "id": id})
}
