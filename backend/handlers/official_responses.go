package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"backend/database"
	"backend/middleware"
	"backend/repositories"
	"backend/services"

	"github.com/gorilla/mux"
)

func ListDepartmentsHandler(w http.ResponseWriter, r *http.Request) {
	rows, err := database.DB.Query(`
		SELECT id, name_ru, COALESCE(short_name,''), category_keys, COALESCE(icon,'')
		FROM departments ORDER BY id`)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}
	defer rows.Close()
	var list []map[string]interface{}
	for rows.Next() {
		var id int
		var name, short, icon string
		var cats []string
		if err := rows.Scan(&id, &name, &short, &cats, &icon); err != nil {
			continue
		}
		list = append(list, map[string]interface{}{
			"id": id, "name_ru": name, "short_name": short,
			"category_keys": cats, "icon": icon,
		})
	}
	respondWithJSON(w, http.StatusOK, map[string]interface{}{"departments": list})
}

func GetOfficialResponseHandler(w http.ResponseWriter, r *http.Request) {
	markerID, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil || markerID <= 0 {
		respondWithError(w, http.StatusBadRequest, "Invalid marker id")
		return
	}
	row, err := fetchOfficialResponse(markerID)
	if err != nil {
		respondWithJSON(w, http.StatusOK, map[string]interface{}{"response": nil})
		return
	}
	respondWithJSON(w, http.StatusOK, map[string]interface{}{"response": row})
}

func PostOfficialResponseHandler(w http.ResponseWriter, r *http.Request) {
	uid, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	if !canPostOfficialResponse(r, uid) {
		respondWithError(w, http.StatusForbidden, "Только представитель ведомства или модератор")
		return
	}
	markerID, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil || markerID <= 0 {
		respondWithError(w, http.StatusBadRequest, "Invalid marker id")
		return
	}
	var body struct {
		DepartmentID int    `json:"department_id"`
		ResponseText string `json:"response_text"`
		ResponseType string `json:"response_type"`
		PlannedDate  string `json:"planned_date"`
		ActualDate   string `json:"actual_date"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid JSON")
		return
	}
	text := strings.TrimSpace(body.ResponseText)
	if text == "" || body.DepartmentID <= 0 {
		respondWithError(w, http.StatusBadRequest, "department_id and response_text required")
		return
	}
	rtype := strings.TrimSpace(body.ResponseType)
	if rtype == "" {
		rtype = "info_requested"
	}
	var id int
	err = database.DB.QueryRow(`
		INSERT INTO official_responses (marker_id, department_id, responded_by, response_text, response_type, planned_date, actual_date)
		VALUES ($1,$2,$3,$4,$5, NULLIF($6,'')::date, NULLIF($7,'')::date)
		RETURNING id`,
		markerID, body.DepartmentID, uid, text, rtype, body.PlannedDate, body.ActualDate,
	).Scan(&id)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}
	notifyOfficialResponse(markerID, body.DepartmentID)
	row, _ := fetchOfficialResponse(markerID)
	respondWithJSON(w, http.StatusCreated, map[string]interface{}{"status": "success", "response": row})
}

func PutOfficialResponseHandler(w http.ResponseWriter, r *http.Request) {
	uid, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	if !canPostOfficialResponse(r, uid) {
		respondWithError(w, http.StatusForbidden, "Forbidden")
		return
	}
	markerID, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil || markerID <= 0 {
		respondWithError(w, http.StatusBadRequest, "Invalid marker id")
		return
	}
	var body struct {
		ResponseText string `json:"response_text"`
		ResponseType string `json:"response_type"`
		PlannedDate  string `json:"planned_date"`
		ActualDate   string `json:"actual_date"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid JSON")
		return
	}
	res, err := database.DB.Exec(`
		UPDATE official_responses SET
			response_text = COALESCE(NULLIF($2,''), response_text),
			response_type = COALESCE(NULLIF($3,''), response_type),
			planned_date = CASE WHEN $4 = '' THEN planned_date ELSE $4::date END,
			actual_date = CASE WHEN $5 = '' THEN actual_date ELSE $5::date END,
			updated_at = NOW()
		WHERE marker_id = $1`,
		markerID, body.ResponseText, body.ResponseType, body.PlannedDate, body.ActualDate,
	)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		respondWithError(w, http.StatusNotFound, "Response not found")
		return
	}
	row, _ := fetchOfficialResponse(markerID)
	respondWithJSON(w, http.StatusOK, map[string]interface{}{"status": "success", "response": row})
}

func canPostOfficialResponse(r *http.Request, uid int) bool {
	if middleware.GetIsModeratorFromContext(r.Context()) || middleware.GetIsAdminFromContext(r.Context()) {
		return true
	}
	var rep bool
	_ = database.DB.QueryRow(`SELECT COALESCE(is_department_rep,false) FROM users WHERE id = $1`, uid).Scan(&rep)
	return rep
}

func fetchOfficialResponse(markerID int) (map[string]interface{}, error) {
	var id, deptID int
	var text, rtype string
	var planned, actual *time.Time
	var created, updated time.Time
	var deptName, deptIcon string
	err := database.DB.QueryRow(`
		SELECT o.id, o.department_id, o.response_text, o.response_type,
		       o.planned_date, o.actual_date, o.created_at, o.updated_at,
		       d.name_ru, COALESCE(d.icon,'')
		FROM official_responses o
		JOIN departments d ON d.id = o.department_id
		WHERE o.marker_id = $1
		ORDER BY o.updated_at DESC LIMIT 1`, markerID,
	).Scan(&id, &deptID, &text, &rtype, &planned, &actual, &created, &updated, &deptName, &deptIcon)
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{
		"id": id, "marker_id": markerID, "department_id": deptID,
		"department_name": deptName, "department_icon": deptIcon,
		"response_text": text, "response_type": rtype,
		"planned_date": planned, "actual_date": actual,
		"created_at": created, "updated_at": updated,
	}, nil
}

func notifyOfficialResponse(markerID, deptID int) {
	var ownerID int
	var deptName string
	if err := database.DB.QueryRow(`SELECT user_id FROM markers WHERE id = $1`, markerID).Scan(&ownerID); err != nil || ownerID <= 0 {
		return
	}
	_ = database.DB.QueryRow(`SELECT name_ru FROM departments WHERE id = $1`, deptID).Scan(&deptName)
	mid := markerID
	nrepo := repositories.NewNotificationRepository()
	title := "📨 Получен официальный ответ"
	body := "Ведомство «" + deptName + "» ответило на ваше обращение."
	_, _ = nrepo.Create(ownerID, "official_response", &mid, title, body)
	markerIDPtr := markerID
	services.AwardPoints(ownerID, "official_response", services.PointsOfficialReply, "Официальный ответ ведомства", &markerIDPtr)
}
