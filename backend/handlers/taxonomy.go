package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"

	"backend/middleware"
	"backend/models"
	"backend/repositories"

	"github.com/gorilla/mux"
)

func allowModeratorOrAdmin(r *http.Request) bool {
	return middleware.GetIsModeratorFromContext(r.Context()) || middleware.GetIsAdminFromContext(r.Context())
}

func GetTaxonomyHandler(w http.ResponseWriter, r *http.Request) {
	tax, err := repositories.ListTaxonomy()
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}
	if tax == nil || len(tax.Domains) == 0 {
		respondWithJSON(w, http.StatusOK, map[string]interface{}{
			"version": 2,
			"domains": []interface{}{},
		})
		return
	}
	respondWithJSON(w, http.StatusOK, tax)
}

func AdminListClassificationsHandler(w http.ResponseWriter, r *http.Request) {
	if !allowModeratorOrAdmin(r) {
		respondWithError(w, http.StatusForbidden, "Moderator or admin only")
		return
	}
	list, err := repositories.ListAdminClassifications()
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}
	if list == nil {
		list = []models.AdminClassificationRow{}
	}
	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"status":          "success",
		"classifications": list,
		"count":           len(list),
		"marker_icons":    repositories.AllowedMarkerIconsList(),
	})
}

func AdminCreateClassificationHandler(w http.ResponseWriter, r *http.Request) {
	if !allowModeratorOrAdmin(r) {
		respondWithError(w, http.StatusForbidden, "Moderator or admin only")
		return
	}
	var req models.CreateClassificationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid JSON")
		return
	}
	if err := repositories.CreateClassification(req); err != nil {
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}
	tax, _ := repositories.ListTaxonomy()
	respondWithJSON(w, http.StatusCreated, map[string]interface{}{
		"status":   "success",
		"taxonomy": tax,
	})
}

func AdminPatchClassificationHandler(w http.ResponseWriter, r *http.Request) {
	if !allowModeratorOrAdmin(r) {
		respondWithError(w, http.StatusForbidden, "Moderator or admin only")
		return
	}
	key := strings.TrimSpace(mux.Vars(r)["key"])
	if key == "" {
		respondWithError(w, http.StatusBadRequest, "Invalid key")
		return
	}
	var req models.UpdateClassificationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid JSON")
		return
	}
	if err := repositories.UpdateClassification(key, req); err != nil {
		if err == sql.ErrNoRows {
			respondWithError(w, http.StatusNotFound, "Classification not found")
			return
		}
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}
	tax, _ := repositories.ListTaxonomy()
	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"status":   "success",
		"taxonomy": tax,
	})
}

func AdminReorderClassificationsHandler(w http.ResponseWriter, r *http.Request) {
	if !allowModeratorOrAdmin(r) {
		respondWithError(w, http.StatusForbidden, "Moderator or admin only")
		return
	}
	var req models.ReorderClassificationsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid JSON")
		return
	}
	if err := repositories.ReorderClassifications(req.Keys); err != nil {
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}
	tax, _ := repositories.ListTaxonomy()
	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"status":   "success",
		"taxonomy": tax,
	})
}

func AdminDeleteClassificationHandler(w http.ResponseWriter, r *http.Request) {
	if !allowModeratorOrAdmin(r) {
		respondWithError(w, http.StatusForbidden, "Moderator or admin only")
		return
	}
	key := strings.TrimSpace(mux.Vars(r)["key"])
	if err := repositories.DeleteClassification(key); err != nil {
		if err == sql.ErrNoRows {
			respondWithError(w, http.StatusNotFound, "Classification not found")
			return
		}
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}
	respondWithJSON(w, http.StatusOK, map[string]interface{}{"status": "success"})
}
