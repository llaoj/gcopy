package pubsub

import (
	"sync"
)

// https://medium.com/@mhrlife/long-polling-with-golang-158f73474cbc

type PubSub struct {
	channels []chan struct{}
	lock     *sync.RWMutex
}

func NewPubSub() *PubSub {
	return &PubSub{
		channels: make([]chan struct{}, 0),
		lock:     new(sync.RWMutex),
	}
}

func (p *PubSub) Subscribe() (<-chan struct{}, func()) {
	p.lock.Lock()
	defer p.lock.Unlock()

	c := make(chan struct{}, 1)
	p.channels = append(p.channels, c)
	return c, func() {
		p.lock.Lock()
		defer p.lock.Unlock()

		for i, channel := range p.channels {
			if channel == c {
				p.channels = append(p.channels[:i], p.channels[i+1:]...)
				close(c)
				return
			}
		}
	}
}

func (p *PubSub) Publish() {
	p.lock.RLock()
	defer p.lock.RUnlock()

	// continue if the channel is full
	for _, channel := range p.channels {
		select {
		case channel <- struct{}{}:
		default:
		}
	}
}
