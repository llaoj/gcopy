package server

import (
	"sync"
	"time"

	"github.com/llaoj/gcopy/internal/gcopy"
	"github.com/llaoj/gcopy/pkg/utils"
	"github.com/sirupsen/logrus"
)

type Clipboards struct {
	mu  *sync.RWMutex
	cbs map[string]*gcopy.Clipboard
	log *logrus.Logger
}

func NewClipboards(log *logrus.Logger) *Clipboards {
	return &Clipboards{
		mu:  &sync.RWMutex{},
		cbs: make(map[string]*gcopy.Clipboard),
		log: log,
	}
}

func (c *Clipboards) Set(key string, cb *gcopy.Clipboard) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.cbs[key] = cb
}

func (c *Clipboards) Get(key string) *gcopy.Clipboard {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.cbs[key]
}

func (s *Clipboards) Housekeeping() func() {
	ticker := time.NewTicker(time.Minute)

	go func() {
		for range ticker.C {
			for key := range s.cbs {
				cb := s.Get(key)
				if time.Since(cb.CreatedAt) > 24*time.Hour {
					delete(s.cbs, key)
					s.log.Infof("[%s] Clipboard expired", utils.StrMaskMiddle(key))
				}
			}
		}
	}()

	return func() {
		ticker.Stop()
	}
}
