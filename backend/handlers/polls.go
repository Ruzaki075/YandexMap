package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"backend/database"
	"backend/middleware"
	"backend/services"

	"github.com/gorilla/mux"
)

func ListPollsHandler(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	pageSize := 20
	status := strings.TrimSpace(r.URL.Query().Get("status"))
	if status == "" {
		status = "active"
	}
	category := strings.TrimSpace(r.URL.Query().Get("category"))
	offset := (page - 1) * pageSize

	q := `
		SELECT p.id, p.title_ru, COALESCE(p.description_ru,''), COALESCE(p.category_key,''),
		       p.status, p.poll_type, p.ends_at, p.show_results_before_vote,
		       (SELECT COUNT(DISTINCT user_id) FROM poll_votes WHERE poll_id = p.id)
		FROM polls p
		WHERE ($1 = '' OR p.status = $1)
		  AND ($2 = '' OR p.category_key = $2)
		  AND (p.ends_at IS NULL OR p.ends_at > NOW() OR $1 = 'closed')
		ORDER BY p.created_at DESC
		LIMIT $3 OFFSET $4`
	rows, err := database.DB.Query(q, status, category, pageSize, offset)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}
	defer rows.Close()
	var polls []map[string]interface{}
	for rows.Next() {
		p, err := scanPollRow(rows)
		if err == nil {
			polls = append(polls, p)
		}
	}
	respondWithJSON(w, http.StatusOK, map[string]interface{}{"polls": polls, "page": page})
}

func GetPollHandler(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil || id <= 0 {
		respondWithError(w, http.StatusBadRequest, "Invalid poll id")
		return
	}
	viewer := middleware.UserIDFromAuthHeader(r)
	poll, err := loadPollDetail(id, viewer)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "Poll not found")
		return
	}
	respondWithJSON(w, http.StatusOK, poll)
}

func PollResultsHandler(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil || id <= 0 {
		respondWithError(w, http.StatusBadRequest, "Invalid poll id")
		return
	}
	poll, err := loadPollDetail(id, 0)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "Poll not found")
		return
	}
	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"results": poll["options"],
		"total_votes": poll["total_voters"],
	})
}

func VotePollHandler(w http.ResponseWriter, r *http.Request) {
	uid, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	pollID, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil || pollID <= 0 {
		respondWithError(w, http.StatusBadRequest, "Invalid poll id")
		return
	}
	var body struct {
		OptionID int `json:"option_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.OptionID <= 0 {
		respondWithError(w, http.StatusBadRequest, "option_id required")
		return
	}
	var status string
	var endsAt *time.Time
	if err := database.DB.QueryRow(`SELECT status, ends_at FROM polls WHERE id = $1`, pollID).Scan(&status, &endsAt); err != nil {
		respondWithError(w, http.StatusNotFound, "Poll not found")
		return
	}
	if status != "active" || (endsAt != nil && endsAt.Before(time.Now())) {
		respondWithError(w, http.StatusBadRequest, "Опрос закрыт")
		return
	}
	var exists bool
	_ = database.DB.QueryRow(`SELECT EXISTS(SELECT 1 FROM poll_votes WHERE poll_id = $1 AND user_id = $2)`, pollID, uid).Scan(&exists)
	if exists {
		respondWithError(w, http.StatusConflict, "Вы уже голосовали")
		return
	}
	var optPoll int
	if err := database.DB.QueryRow(`SELECT poll_id FROM poll_options WHERE id = $1`, body.OptionID).Scan(&optPoll); err != nil || optPoll != pollID {
		respondWithError(w, http.StatusBadRequest, "Invalid option")
		return
	}
	tx, err := database.DB.Begin()
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}
	defer tx.Rollback()
	if _, err := tx.Exec(`INSERT INTO poll_votes (poll_id, option_id, user_id) VALUES ($1,$2,$3)`, pollID, body.OptionID, uid); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}
	if _, err := tx.Exec(`UPDATE poll_options SET votes_count = votes_count + 1 WHERE id = $1`, body.OptionID); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}
	if err := tx.Commit(); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}
	services.AwardPoints(uid, "vote_cast", services.PointsVoteCast, "Участие в опросе", nil)
	poll, _ := loadPollDetail(pollID, uid)
	respondWithJSON(w, http.StatusOK, map[string]interface{}{"status": "success", "poll": poll})
}

func AdminCreatePollHandler(w http.ResponseWriter, r *http.Request) {
	if !middleware.GetIsModeratorFromContext(r.Context()) && !middleware.GetIsAdminFromContext(r.Context()) {
		respondWithError(w, http.StatusForbidden, "Moderator or admin only")
		return
	}
	uid, _ := middleware.GetUserIDFromContext(r.Context())
	var body struct {
		TitleRu              string   `json:"title_ru"`
		DescriptionRu        string   `json:"description_ru"`
		CategoryKey          string   `json:"category_key"`
		District             string   `json:"district"`
		PollType             string   `json:"poll_type"`
		EndsAt               string   `json:"ends_at"`
		ShowResultsBeforeVote bool    `json:"show_results_before_vote"`
		Options              []string `json:"options"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid JSON")
		return
	}
	if strings.TrimSpace(body.TitleRu) == "" || len(body.Options) < 2 {
		respondWithError(w, http.StatusBadRequest, "title_ru and at least 2 options required")
		return
	}
	ptype := body.PollType
	if ptype == "" {
		ptype = "single"
	}
	var pollID int
	err := database.DB.QueryRow(`
		INSERT INTO polls (title_ru, description_ru, category_key, district, poll_type, created_by, ends_at, show_results_before_vote)
		VALUES ($1,$2,NULLIF($3,''),NULLIF($4,''),$5,$6,NULLIF($7,'')::timestamp,$8)
		RETURNING id`,
		body.TitleRu, body.DescriptionRu, body.CategoryKey, body.District, ptype, uid, body.EndsAt, body.ShowResultsBeforeVote,
	).Scan(&pollID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}
	for i, opt := range body.Options {
		text := strings.TrimSpace(opt)
		if text == "" {
			continue
		}
		_, _ = database.DB.Exec(
			`INSERT INTO poll_options (poll_id, text_ru, order_num) VALUES ($1,$2,$3)`,
			pollID, text, i,
		)
	}
	poll, _ := loadPollDetail(pollID, 0)
	respondWithJSON(w, http.StatusCreated, map[string]interface{}{"status": "success", "poll": poll})
}

func AdminUpdatePollHandler(w http.ResponseWriter, r *http.Request) {
	if !middleware.GetIsModeratorFromContext(r.Context()) && !middleware.GetIsAdminFromContext(r.Context()) {
		respondWithError(w, http.StatusForbidden, "Forbidden")
		return
	}
	id, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil || id <= 0 {
		respondWithError(w, http.StatusBadRequest, "Invalid id")
		return
	}
	var body struct {
		Status  string `json:"status"`
		EndsAt  string `json:"ends_at"`
		TitleRu string `json:"title_ru"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid JSON")
		return
	}
	_, err = database.DB.Exec(`
		UPDATE polls SET
			status = COALESCE(NULLIF($2,''), status),
			ends_at = CASE WHEN $3 = '' THEN ends_at ELSE $3::timestamp END,
			title_ru = COALESCE(NULLIF($4,''), title_ru)
		WHERE id = $1`, id, body.Status, body.EndsAt, body.TitleRu)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}
	poll, _ := loadPollDetail(id, 0)
	respondWithJSON(w, http.StatusOK, map[string]interface{}{"status": "success", "poll": poll})
}

func loadPollDetail(pollID, viewerID int) (map[string]interface{}, error) {
	var id int
	var title, desc, cat, status, ptype string
	var endsAt *time.Time
	var showBefore bool
	var voters int
	err := database.DB.QueryRow(`
		SELECT p.id, p.title_ru, COALESCE(p.description_ru,''), COALESCE(p.category_key,''),
		       p.status, p.poll_type, p.ends_at, p.show_results_before_vote,
		       (SELECT COUNT(DISTINCT user_id) FROM poll_votes WHERE poll_id = p.id)
		FROM polls p WHERE p.id = $1`, pollID,
	).Scan(&id, &title, &desc, &cat, &status, &ptype, &endsAt, &showBefore, &voters)
	if err != nil {
		return nil, err
	}
	voted := false
	if viewerID > 0 {
		_ = database.DB.QueryRow(
			`SELECT EXISTS(SELECT 1 FROM poll_votes WHERE poll_id = $1 AND user_id = $2)`,
			pollID, viewerID,
		).Scan(&voted)
	}
	showResults := voted || showBefore || status == "closed" || (endsAt != nil && endsAt.Before(time.Now()))
	rows, err := database.DB.Query(`
		SELECT id, text_ru, votes_count, order_num FROM poll_options
		WHERE poll_id = $1 ORDER BY order_num`, pollID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var options []map[string]interface{}
	totalVotes := 0
	for rows.Next() {
		var oid, votes, ord int
		var text string
		if err := rows.Scan(&oid, &text, &votes, &ord); err != nil {
			continue
		}
		totalVotes += votes
		opt := map[string]interface{}{"id": oid, "text_ru": text, "votes_count": votes, "order_num": ord}
		if showResults && totalVotes > 0 {
			opt["percent"] = float64(votes) * 100 / float64(maxInt(voters, totalVotes))
		}
		options = append(options, opt)
	}
	return map[string]interface{}{
		"id": id, "title_ru": title, "description_ru": desc, "category_key": cat,
		"status": status, "poll_type": ptype, "ends_at": endsAt,
		"show_results_before_vote": showBefore, "total_voters": voters,
		"voted": voted, "show_results": showResults, "options": options,
	}, nil
}

func scanPollRow(rows interface {
	Scan(dest ...interface{}) error
}) (map[string]interface{}, error) {
	var id, voters int
	var title, desc, cat, status, ptype string
	var endsAt *time.Time
	var showBefore bool
	if err := rows.Scan(&id, &title, &desc, &cat, &status, &ptype, &endsAt, &showBefore, &voters); err != nil {
		return nil, err
	}
	return map[string]interface{}{
		"id": id, "title_ru": title, "description_ru": desc, "category_key": cat,
		"status": status, "poll_type": ptype, "ends_at": endsAt,
		"total_voters": voters, "show_results_before_vote": showBefore,
	}, nil
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

// ActivePollWidget — один активный опрос для виджета на карте.
func ActivePollWidgetHandler(w http.ResponseWriter, r *http.Request) {
	var id int
	err := database.DB.QueryRow(`
		SELECT id FROM polls
		WHERE status = 'active' AND (ends_at IS NULL OR ends_at > NOW())
		ORDER BY created_at DESC LIMIT 1`).Scan(&id)
	if err != nil {
		respondWithJSON(w, http.StatusOK, map[string]interface{}{"poll": nil})
		return
	}
	viewer := middleware.UserIDFromAuthHeader(r)
	poll, err := loadPollDetail(id, viewer)
	if err != nil {
		respondWithJSON(w, http.StatusOK, map[string]interface{}{"poll": nil})
		return
	}
	respondWithJSON(w, http.StatusOK, map[string]interface{}{"poll": poll})
}
