package server

import (
	"sync"
	"time"

	"github.com/llaoj/gcopy/internal/gcopy"
	applog "github.com/llaoj/gcopy/internal/log"
)

// Clipboards on the wall
type Wall struct {
	log *applog.Logger
	cbs sync.Map
}

func NewWall(log *applog.Logger) *Wall {
	return &Wall{log: log}
}

func (w *Wall) Set(key string, cb *gcopy.Clipboard) {
	w.cbs.Store(key, cb)
}

func (w *Wall) Get(key string) *gcopy.Clipboard {
	v, ok := w.cbs.Load(key)
	if ok {
		return v.(*gcopy.Clipboard)
	}
	return nil
}

func (w *Wall) Housekeeping() func() {
	ticker := time.NewTicker(time.Minute)

	go func() {
		for range ticker.C {
			w.cbs.Range(func(key, value any) bool {
				cb := value.(*gcopy.Clipboard)
				if time.Since(cb.CreatedAt) > 24*time.Hour {
					// CompareAndDelete avoids removing an entry that has been
					// replaced with a newer one since it was read.
					w.cbs.CompareAndDelete(key, value)
					w.log.Info("Clipboard expired")
				}
				return true
			})
		}
	}()

	return func() {
		ticker.Stop()
	}
}
