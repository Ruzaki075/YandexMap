package handlers

import (
	"net/http"
	"strings"

	"backend/middleware"
	"backend/realtime"
	"github.com/gorilla/websocket"
)

var wsUpgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

func WebSocketHandler(w http.ResponseWriter, r *http.Request) {
	token := strings.TrimSpace(r.URL.Query().Get("token"))
	if token == "" {
		auth := r.Header.Get("Authorization")
		if strings.HasPrefix(auth, "Bearer ") {
			token = strings.TrimPrefix(auth, "Bearer ")
		}
	}
	claims, err := middleware.ParseToken(token)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	conn, err := wsUpgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	client := &realtime.Client{
		UserID:      claims.UserID,
		IsModerator: claims.IsModerator || claims.IsAdmin,
		Conn:        conn,
		Send:        make(chan []byte, 64),
	}
	realtime.RegisterClient(client)
	go func() {
		defer realtime.UnregisterClient(client)
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				break
			}
		}
	}()
}
