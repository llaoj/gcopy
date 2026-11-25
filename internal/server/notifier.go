package server

import "sync"

const maxSubscribersPerUser = 16

// ClipboardStatus is the lightweight metadata pushed to listeners when a
// user's clipboard on the wall changes.
type ClipboardStatus struct {
	Index      int    `json:"index"`
	Type       string `json:"type,omitempty"`
	ClientName string `json:"clientName,omitempty"`
}

// Notifier broadcasts clipboard updates to active SSE connections of the same user.
type Notifier struct {
	mu          sync.Mutex
	subscribers map[string]map[chan ClipboardStatus]struct{}
}

func NewNotifier() *Notifier {
	return &Notifier{
		subscribers: make(map[string]map[chan ClipboardStatus]struct{}),
	}
}

// Subscribe registers a listener channel for userKey and returns an unsubscribe
// function that must be called when the connection closes. If the user already
// has maxSubscribersPerUser open streams, ok is false.
func (n *Notifier) Subscribe(userKey string) (ch chan ClipboardStatus, unsubscribe func(), ok bool) {
	n.mu.Lock()
	defer n.mu.Unlock()

	subs := n.subscribers[userKey]
	if len(subs) >= maxSubscribersPerUser {
		return nil, func() {}, false
	}
	if subs == nil {
		subs = make(map[chan ClipboardStatus]struct{})
		n.subscribers[userKey] = subs
	}

	// Buffer of 1 lets Notify coalesce rapid updates without blocking writers.
	ch = make(chan ClipboardStatus, 1)
	subs[ch] = struct{}{}

	var once sync.Once
	unsubscribe = func() {
		once.Do(func() {
			n.mu.Lock()
			defer n.mu.Unlock()
			if userSubs, exists := n.subscribers[userKey]; exists {
				delete(userSubs, ch)
				if len(userSubs) == 0 {
					delete(n.subscribers, userKey)
				}
			}
		})
	}
	return ch, unsubscribe, true
}

// Notify pushes the latest status to all active subscribers of userKey without blocking.
func (n *Notifier) Notify(userKey string, status ClipboardStatus) {
	n.mu.Lock()
	defer n.mu.Unlock()

	subs := n.subscribers[userKey]
	for ch := range subs {
		select {
		case ch <- status:
		default:
			// Drop stale unread status and replace with the newest one.
			select {
			case <-ch:
			default:
			}
			select {
			case ch <- status:
			default:
			}
		}
	}
}

// SubscriberCount returns the number of active SSE listeners for userKey.
func (n *Notifier) SubscriberCount(userKey string) int {
	n.mu.Lock()
	defer n.mu.Unlock()
	return len(n.subscribers[userKey])
}
