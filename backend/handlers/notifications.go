package handlers

import (
	"net/http"
	"strconv"

	"backend/middleware"
	"backend/repositories"
	"github.com/gorilla/mux"
)

func ListNotificationsHandler(w http.ResponseWriter, r *http.Request) {
	uid, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	repo := repositories.NewNotificationRepository()
	list, total, err := repo.ListForUser(uid, limit, offset)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}
	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"notifications": list,
		"total":         total,
	})
}

func NotificationsUnreadCountHandler(w http.ResponseWriter, r *http.Request) {
	uid, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	repo := repositories.NewNotificationRepository()
	n, err := repo.CountUnread(uid)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}
	respondWithJSON(w, http.StatusOK, map[string]interface{}{"unread": n})
}

func MarkNotificationReadHandler(w http.ResponseWriter, r *http.Request) {
	uid, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	id, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil || id <= 0 {
		respondWithError(w, http.StatusBadRequest, "Invalid id")
		return
	}
	repo := repositories.NewNotificationRepository()
	if err := repo.MarkRead(id, uid); err != nil {
		respondWithError(w, http.StatusNotFound, "Not found")
		return
	}
	respondWithJSON(w, http.StatusOK, map[string]string{"status": "success"})
}

func MarkAllNotificationsReadHandler(w http.ResponseWriter, r *http.Request) {
	uid, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	repo := repositories.NewNotificationRepository()
	if err := repo.MarkAllRead(uid); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}
	respondWithJSON(w, http.StatusOK, map[string]string{"status": "success"})
}
