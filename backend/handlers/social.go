package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"backend/middleware"
	"backend/models"
	"backend/repositories"

	"github.com/gorilla/mux"
)

func NearbyMarkersHandler(w http.ResponseWriter, r *http.Request) {
	lat, _ := strconv.ParseFloat(r.URL.Query().Get("lat"), 64)
	lng, _ := strconv.ParseFloat(r.URL.Query().Get("lng"), 64)
	radius, _ := strconv.Atoi(r.URL.Query().Get("radius_m"))
	if radius <= 0 {
		radius = 100
	}
	if lat == 0 && lng == 0 {
		respondWithError(w, http.StatusBadRequest, "lat and lng required")
		return
	}
	list, err := repositories.NewSupportRepository().FindNearby(lat, lng, radius, 10)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}
	if list == nil {
		list = []models.NearbyMarker{}
	}
	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"nearby": list,
		"count":  len(list),
	})
}

func GetMarkerSupportsHandler(w http.ResponseWriter, r *http.Request) {
	markerID, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil || markerID <= 0 {
		respondWithError(w, http.StatusBadRequest, "Invalid marker id")
		return
	}
	srepo := repositories.NewSupportRepository()
	cnt, _ := srepo.Count(markerID)
	list, err := srepo.List(markerID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}
	var iSupported bool
	if uid, ok := middleware.GetUserIDFromContext(r.Context()); ok {
		iSupported, _ = srepo.UserSupported(markerID, uid)
	}
	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"count":       cnt,
		"supports":    list,
		"i_supported": iSupported,
	})
}

func PostMarkerSupportHandler(w http.ResponseWriter, r *http.Request) {
	uid, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	markerID, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil || markerID <= 0 {
		respondWithError(w, http.StatusBadRequest, "Invalid marker id")
		return
	}
	ownerID, err := repositories.NewMarkerRepository().GetMarkerOwnerUserID(markerID)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "Marker not found")
		return
	}
	if ownerID == uid {
		respondWithError(w, http.StatusBadRequest, "Нельзя подтвердить собственное обращение")
		return
	}
	srepo := repositories.NewSupportRepository()
	added, err := srepo.Add(markerID, uid)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}
	if !added {
		respondWithJSON(w, http.StatusOK, map[string]interface{}{"status": "already"})
		return
	}
	if ownerID > 0 {
		mid := markerID
		nrepo := repositories.NewNotificationRepository()
		_, _ = nrepo.Create(ownerID, "marker_supported", &mid, "Поддержка обращения",
			"Кто-то тоже столкнулся с этой проблемой — приоритет заявки вырос.")
	}
	cnt, _ := srepo.Count(markerID)
	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"status": "success",
		"count":  cnt,
	})
}

func DeleteMarkerSupportHandler(w http.ResponseWriter, r *http.Request) {
	uid, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	markerID, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid marker id")
		return
	}
	if err := repositories.NewSupportRepository().Remove(markerID, uid); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}
	cnt, _ := repositories.NewSupportRepository().Count(markerID)
	respondWithJSON(w, http.StatusOK, map[string]interface{}{"status": "success", "count": cnt})
}

func LeaderboardHandler(w http.ResponseWriter, r *http.Request) {
	list, err := repositories.GetLeaderboard(20)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}
	if list == nil {
		list = []map[string]interface{}{}
	}
	respondWithJSON(w, http.StatusOK, map[string]interface{}{"leaders": list})
}

func HeatmapPointsHandler(w http.ResponseWriter, r *http.Request) {
	layer := strings.TrimSpace(r.URL.Query().Get("layer"))
	repo := repositories.NewMarkerRepository()
	markers, err := repo.GetPublicMarkers(layer)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}
	points := make([]map[string]interface{}, 0, len(markers))
	for _, m := range markers {
		w := 1.0 + float64(m.SupportCount)*0.5
		points = append(points, map[string]interface{}{
			"lat": m.Latitude, "lng": m.Longitude, "weight": w,
		})
	}
	respondWithJSON(w, http.StatusOK, map[string]interface{}{"points": points})
}
