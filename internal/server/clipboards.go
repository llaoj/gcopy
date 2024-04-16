package server

import (
	"sync"
	"time"

	"github.com/llaoj/gcopy/internal/gcopy"
	"github.com/llaoj/gcopy/pkg/utils"
	"github.com/sirupsen/logrus"
)

type Clipboards struct {
	log *logrus.Logger
	cbs sync.Map
}

func NewClipboards(log *logrus.Logger) *Clipboards {
	return &Clipboards{
		log: log,
	}
}

func (c *Clipboards) Set(key string, cb *gcopy.Clipboard) {
	c.cbs.Store(key, cb)
}

func (c *Clipboards) Get(key string) *gcopy.Clipboard {
	v, ok := c.cbs.Load(key)
	if ok {
		return v.(*gcopy.Clipboard)
	}
	return nil
}

func (c *Clipboards) Del(key string) {
	c.cbs.Delete(key)
}

func (c *Clipboards) Housekeeping() func() {
	ticker := time.NewTicker(time.Minute)

	go func() {
		for range ticker.C {
			c.cbs.Range(func(key, value any) bool {
				cp := value.(*gcopy.Clipboard)
				if time.Since(cp.CreatedAt) > 24*time.Hour {
					c.cbs.Delete(key)
					c.log.Infof("[%s] Clipboard expired", utils.StrMaskMiddle(key.(string)))
				}
				return true
			})
		}
	}()

	return func() {
		ticker.Stop()
	}
}
