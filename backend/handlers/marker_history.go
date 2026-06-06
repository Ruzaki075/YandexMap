package handlers

import (
	"net/http"
	"strconv"

	"backend/repositories"

	"github.com/gorilla/mux"
)

func GetMarkerStatusHistoryHandler(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil || id <= 0 {
		respondWithError(w, http.StatusBadRequest, "Invalid marker id")
		return
	}
	list, err := repositories.ListMarkerStatusLog(id, 50)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}
	if list == nil {
		list = []repositories.MarkerStatusLogEntry{}
	}
	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"status":  "success",
		"history": list,
		"count":   len(list),
	})
}
