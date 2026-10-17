package auth

import (
	"sync"
	"time"
)

// tokenTTL is how long a reserved token is kept before it can be reused.
// It matches the session lifetime so a token is not handed out again while
// a session holding it may still be alive.
const tokenTTL = 7 * 24 * time.Hour

// tokenRegistry tracks currently reserved tokens so that generated tokens are
// unique among active sessions. It is memory-only and resets on restart.
type tokenRegistry struct {
	tokens sync.Map // token(string) -> reservedAt(time.Time)
	once   sync.Once
}

// reserve generates a token that is not currently reserved and stores it.
func (r *tokenRegistry) reserve() (string, error) {
	r.once.Do(func() { go r.housekeeping() })

	for {
		token, err := generateToken()
		if err != nil {
			return "", err
		}
		if _, loaded := r.tokens.LoadOrStore(token, time.Now()); !loaded {
			return token, nil
		}
	}
}

// housekeeping periodically drops expired reservations.
func (r *tokenRegistry) housekeeping() {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		now := time.Now()
		r.tokens.Range(func(key, value any) bool {
			if reservedAt, ok := value.(time.Time); ok && now.Sub(reservedAt) > tokenTTL {
				r.tokens.Delete(key)
			}
			return true
		})
	}
}
