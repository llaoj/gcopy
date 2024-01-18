package server

import (
	"sync"

	"github.com/llaoj/gcopy/internal/gcopy"
)

type Clipboards struct {
	mu  *sync.RWMutex
	cbs map[string]*gcopy.Clipboard
}

func NewClipboards() *Clipboards {
	return &Clipboards{
		mu:  &sync.RWMutex{},
		cbs: make(map[string]*gcopy.Clipboard),
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
