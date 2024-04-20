package server

import (
	"sync"
	"time"

	"github.com/llaoj/gcopy/internal/gcopy"
	"github.com/llaoj/gcopy/pkg/utils"
	"github.com/sirupsen/logrus"
)

// Clipboards on the wall
type Wall struct {
	log *logrus.Logger
	cbs sync.Map
}

func NewWall(log *logrus.Logger) *Wall {
	return &Wall{
		log: log,
	}
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

func (w *Wall) Del(key string) {
	w.cbs.Delete(key)
}

func (w *Wall) Housekeeping() func() {
	ticker := time.NewTicker(time.Minute)

	go func() {
		for range ticker.C {
			w.cbs.Range(func(key, value any) bool {
				cb := value.(*gcopy.Clipboard)
				if time.Since(cb.CreatedAt) > 24*time.Hour {
					w.cbs.Delete(key)
					w.log.Infof("[%s] Clipboard expired", utils.StrMaskMiddle(key.(string)))
				}
				return true
			})
		}
	}()

	return func() {
		ticker.Stop()
	}
}
