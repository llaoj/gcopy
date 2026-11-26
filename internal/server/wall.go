package server

import (
	"sync"
	"time"

	"github.com/llaoj/gcopy/internal/gcopy"
	applog "github.com/llaoj/gcopy/internal/log"
)

const clipboardTTL = 24 * time.Hour

// Clipboards on the wall.
// Each user's active clipboard hangs on the wall until it expires (24h) or is
// evicted when total memory exceeds maxBytes.
type Wall struct {
	log        *applog.Logger
	mu         sync.Mutex
	clipboards map[string]*gcopy.Clipboard
	lastUsed   map[string]uint64
	order      uint64
	usedBytes  int64
	maxBytes   int64
	ttl        time.Duration
}

func NewWall(log *applog.Logger, maxBytes int64) *Wall {
	return &Wall{
		log:        log,
		clipboards: make(map[string]*gcopy.Clipboard),
		lastUsed:   make(map[string]uint64),
		maxBytes:   maxBytes,
		ttl:        clipboardTTL,
	}
}

func clipboardSize(clipboard *gcopy.Clipboard) int64 {
	if clipboard == nil {
		return 0
	}
	return int64(len(clipboard.Data) + len(clipboard.FileName) + len(clipboard.Type) + len(clipboard.ClientName) + len(clipboard.MIMEType))
}

func (w *Wall) Set(userID string, clipboard *gcopy.Clipboard) {
	if clipboard == nil {
		return
	}
	size := clipboardSize(clipboard)
	if w.maxBytes > 0 && size > w.maxBytes {
		if w.log != nil {
			w.log.Warnf("Clipboard (%d bytes) exceeds wall memory limit (%d bytes), skipped", size, w.maxBytes)
		}
		return
	}

	w.mu.Lock()
	defer w.mu.Unlock()

	if old, ok := w.clipboards[userID]; ok {
		w.deleteLocked(userID, old)
	}

	for w.maxBytes > 0 && w.usedBytes+size > w.maxBytes && len(w.clipboards) > 0 {
		w.evictLeastRecentlyUsedLocked()
	}

	w.order++
	w.clipboards[userID] = clipboard
	w.lastUsed[userID] = w.order
	w.usedBytes += size
}

func (w *Wall) Get(userID string) *gcopy.Clipboard {
	w.mu.Lock()
	defer w.mu.Unlock()

	clipboard, ok := w.clipboards[userID]
	if !ok {
		return nil
	}
	if w.isExpired(clipboard) {
		w.deleteLocked(userID, clipboard)
		if w.log != nil {
			w.log.Info("Clipboard expired")
		}
		return nil
	}

	w.order++
	w.lastUsed[userID] = w.order
	return clipboard
}

func (w *Wall) UsedBytes() int64 {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.usedBytes
}

func (w *Wall) Len() int {
	w.mu.Lock()
	defer w.mu.Unlock()
	return len(w.clipboards)
}

func (w *Wall) isExpired(clipboard *gcopy.Clipboard) bool {
	return w.ttl > 0 && !clipboard.CreatedAt.IsZero() && time.Since(clipboard.CreatedAt) > w.ttl
}

func (w *Wall) deleteLocked(userID string, clipboard *gcopy.Clipboard) {
	delete(w.clipboards, userID)
	delete(w.lastUsed, userID)
	w.usedBytes -= clipboardSize(clipboard)
	if w.usedBytes < 0 {
		w.usedBytes = 0
	}
}

func (w *Wall) evictLeastRecentlyUsedLocked() {
	var oldestUserID string
	var oldestOrder uint64
	first := true

	for userID, order := range w.lastUsed {
		if first || order < oldestOrder {
			oldestUserID = userID
			oldestOrder = order
			first = false
		}
	}
	if !first {
		w.deleteLocked(oldestUserID, w.clipboards[oldestUserID])
		if w.log != nil {
			w.log.Info("Clipboard evicted by wall memory limit")
		}
	}
}

func (w *Wall) ExpireStale() int {
	w.mu.Lock()
	defer w.mu.Unlock()

	expired := 0
	for userID, clipboard := range w.clipboards {
		if w.isExpired(clipboard) {
			w.deleteLocked(userID, clipboard)
			expired++
			if w.log != nil {
				w.log.Info("Clipboard expired")
			}
		}
	}
	return expired
}

func (w *Wall) Housekeeping() func() {
	ticker := time.NewTicker(time.Minute)

	go func() {
		for range ticker.C {
			w.ExpireStale()
		}
	}()

	return func() {
		ticker.Stop()
	}
}
