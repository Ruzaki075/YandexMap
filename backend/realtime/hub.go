package realtime

import (
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const (
	EventMarkerCreated  = "marker_created"
	EventMarkerUpdated  = "marker_updated"
	EventNotification   = "notification"
	EventModerationPing = "moderation_presence"
)

type Event struct {
	Type      string      `json:"type"`
	Payload   interface{} `json:"payload"`
	Timestamp int64       `json:"ts"`
}

type Client struct {
	UserID      int
	IsModerator bool
	Conn        *websocket.Conn
	Send        chan []byte
}

var Hub = &hub{
	clients:    make(map[*Client]bool),
	moderators: make(map[int]bool),
	broadcast:  make(chan []byte, 256),
	register:   make(chan *Client),
	unregister: make(chan *Client),
}

type hub struct {
	mu         sync.RWMutex
	clients    map[*Client]bool
	moderators map[int]bool
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
}

func Start() {
	go Hub.run()
}

func (h *hub) run() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case c := <-h.register:
			h.mu.Lock()
			h.clients[c] = true
			if c.IsModerator {
				h.moderators[c.UserID] = true
			}
			h.mu.Unlock()
			h.broadcastModerationPresence()
		case c := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[c]; ok {
				delete(h.clients, c)
				close(c.Send)
			}
			if c.IsModerator {
				delete(h.moderators, c.UserID)
			}
			h.mu.Unlock()
			h.broadcastModerationPresence()
		case msg := <-h.broadcast:
			h.mu.RLock()
			for c := range h.clients {
				select {
				case c.Send <- msg:
				default:
					close(c.Send)
					delete(h.clients, c)
				}
			}
			h.mu.RUnlock()
		case <-ticker.C:
			h.mu.RLock()
			for c := range h.clients {
				_ = c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
				if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
					close(c.Send)
					delete(h.clients, c)
				}
			}
			h.mu.RUnlock()
		}
	}
}

func (h *hub) broadcastModerationPresence() {
	h.mu.RLock()
	ids := make([]int, 0, len(h.moderators))
	for id := range h.moderators {
		ids = append(ids, id)
	}
	count := len(h.moderators)
	h.mu.RUnlock()
	Broadcast(Event{
		Type: EventModerationPing,
		Payload: map[string]interface{}{
			"online_count": count,
			"moderator_ids": ids,
		},
	})
}

func Broadcast(ev Event) {
	ev.Timestamp = time.Now().Unix()
	b, err := json.Marshal(ev)
	if err != nil {
		return
	}
	select {
	case Hub.broadcast <- b:
	default:
		log.Printf("realtime: broadcast channel full, drop %s", ev.Type)
	}
}

func BroadcastToUser(userID int, ev Event) {
	ev.Timestamp = time.Now().Unix()
	b, err := json.Marshal(ev)
	if err != nil {
		return
	}
	Hub.mu.RLock()
	defer Hub.mu.RUnlock()
	for c := range Hub.clients {
		if c.UserID == userID {
			select {
			case c.Send <- b:
			default:
			}
		}
	}
}

func RegisterClient(c *Client) {
	Hub.register <- c
	go c.writePump()
}

func UnregisterClient(c *Client) {
	Hub.unregister <- c
}

func (c *Client) writePump() {
	defer func() {
		Hub.unregister <- c
		_ = c.Conn.Close()
	}()
	for msg := range c.Send {
		_ = c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
		if err := c.Conn.WriteMessage(websocket.TextMessage, msg); err != nil {
			return
		}
	}
}

func ModeratorOnlineCount() int {
	Hub.mu.RLock()
	defer Hub.mu.RUnlock()
	return len(Hub.moderators)
}
