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
	seq        uint64
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

func clipboardSize(cb *gcopy.Clipboard) int64 {
	if cb == nil {
		return 0
	}
	return int64(len(cb.Data) + len(cb.FileName) + len(cb.Type) + len(cb.ClientName) + len(cb.MIMEType))
}

func (w *Wall) Set(key string, cb *gcopy.Clipboard) {
	if cb == nil {
		return
	}
	size := clipboardSize(cb)
	if w.maxBytes > 0 && size > w.maxBytes {
		if w.log != nil {
			w.log.Warnf("Clipboard (%d bytes) exceeds wall memory limit (%d bytes), skipped", size, w.maxBytes)
		}
		return
	}

	w.mu.Lock()
	defer w.mu.Unlock()

	if old, ok := w.clipboards[key]; ok {
		w.deleteLocked(key, old)
	}

	for w.maxBytes > 0 && w.usedBytes+size > w.maxBytes && len(w.clipboards) > 0 {
		w.evictLeastRecentlyUsedLocked()
	}

	w.seq++
	w.clipboards[key] = cb
	w.lastUsed[key] = w.seq
	w.usedBytes += size
}

func (w *Wall) Get(key string) *gcopy.Clipboard {
	w.mu.Lock()
	defer w.mu.Unlock()

	cb, ok := w.clipboards[key]
	if !ok {
		return nil
	}
	if w.isExpired(cb) {
		w.deleteLocked(key, cb)
		if w.log != nil {
			w.log.Info("Clipboard expired")
		}
		return nil
	}

	w.seq++
	w.lastUsed[key] = w.seq
	return cb
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

func (w *Wall) isExpired(cb *gcopy.Clipboard) bool {
	return w.ttl > 0 && !cb.CreatedAt.IsZero() && time.Since(cb.CreatedAt) > w.ttl
}

func (w *Wall) deleteLocked(key string, cb *gcopy.Clipboard) {
	delete(w.clipboards, key)
	delete(w.lastUsed, key)
	w.usedBytes -= clipboardSize(cb)
	if w.usedBytes < 0 {
		w.usedBytes = 0
	}
}

func (w *Wall) evictLeastRecentlyUsedLocked() {
	var oldestKey string
	var oldestSeq uint64
	first := true

	for k, seq := range w.lastUsed {
		if first || seq < oldestSeq {
			oldestKey = k
			oldestSeq = seq
			first = false
		}
	}
	if !first {
		w.deleteLocked(oldestKey, w.clipboards[oldestKey])
		if w.log != nil {
			w.log.Info("Clipboard evicted by wall memory limit")
		}
	}
}

func (w *Wall) ExpireStale() int {
	w.mu.Lock()
	defer w.mu.Unlock()

	expired := 0
	for key, cb := range w.clipboards {
		if w.isExpired(cb) {
			w.deleteLocked(key, cb)
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
