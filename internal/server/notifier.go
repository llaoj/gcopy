package server

import "sync"

const maxSubscribersPerUser = 16

// ClipboardEvent is the lightweight clipboard metadata pushed to SSE listeners
// when a user's clipboard on the wall changes.
type ClipboardEvent struct {
	Index      int    `json:"index"`
	Type       string `json:"type,omitempty"`
	ClientName string `json:"clientName,omitempty"`
}

// Notifier broadcasts clipboard events to active SSE connections of the same user.
type Notifier struct {
	mu          sync.Mutex
	subscribers map[string]map[chan ClipboardEvent]struct{}
}

func NewNotifier() *Notifier {
	return &Notifier{
		subscribers: make(map[string]map[chan ClipboardEvent]struct{}),
	}
}

// Subscribe registers a listener channel for userID and returns an unsubscribe
// function that must be called when the connection closes. If the user already
// has maxSubscribersPerUser open streams, ok is false.
func (n *Notifier) Subscribe(userID string) (listener chan ClipboardEvent, unsubscribe func(), ok bool) {
	n.mu.Lock()
	defer n.mu.Unlock()

	listeners := n.subscribers[userID]
	if len(listeners) >= maxSubscribersPerUser {
		return nil, func() {}, false
	}
	if listeners == nil {
		listeners = make(map[chan ClipboardEvent]struct{})
		n.subscribers[userID] = listeners
	}

	// Buffer of 1 lets Notify coalesce rapid updates without blocking writers.
	listener = make(chan ClipboardEvent, 1)
	listeners[listener] = struct{}{}

	var once sync.Once
	unsubscribe = func() {
		once.Do(func() {
			n.mu.Lock()
			defer n.mu.Unlock()
			if userListeners, exists := n.subscribers[userID]; exists {
				delete(userListeners, listener)
				if len(userListeners) == 0 {
					delete(n.subscribers, userID)
				}
			}
		})
	}
	return listener, unsubscribe, true
}

// Notify pushes the latest event to all active subscribers of userID without blocking.
func (n *Notifier) Notify(userID string, event ClipboardEvent) {
	n.mu.Lock()
	defer n.mu.Unlock()

	listeners := n.subscribers[userID]
	for listener := range listeners {
		select {
		case listener <- event:
		default:
			// Drop stale unread event and replace with the newest one.
			select {
			case <-listener:
			default:
			}
			select {
			case listener <- event:
			default:
			}
		}
	}
}

// SubscriberCount returns the number of active SSE listeners for userID.
func (n *Notifier) SubscriberCount(userID string) int {
	n.mu.Lock()
	defer n.mu.Unlock()
	return len(n.subscribers[userID])
}
