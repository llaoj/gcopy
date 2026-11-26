package server

import (
	"bytes"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/llaoj/gcopy/internal/gcopy"
	applog "github.com/llaoj/gcopy/internal/log"
	"github.com/sirupsen/logrus"
)

func newSilentLogger() *applog.Logger {
	l := logrus.New()
	l.SetOutput(&bytes.Buffer{})
	return applog.New(l, "test-secret-key-16")
}

func TestWallLRUEvictionAndPromotion(t *testing.T) {
	// Cap at 250 bytes; each clipboard below has 100 bytes of data.
	wall := NewWall(newSilentLogger(), 250)

	newClipboard := func(index int, size int) *gcopy.Clipboard {
		return &gcopy.Clipboard{
			Index:     index,
			Data:      bytes.Repeat([]byte("a"), size),
			CreatedAt: time.Now(),
		}
	}

	wall.Set("u1", newClipboard(1, 100))
	wall.Set("u2", newClipboard(1, 100))
	if wall.Len() != 2 || wall.UsedBytes() != 200 {
		t.Fatalf("got len=%d used=%d, want len=2 used=200", wall.Len(), wall.UsedBytes())
	}

	// Reading u1 updates its usage order so u2 becomes least-recently-used.
	if got := wall.Get("u1"); got == nil {
		t.Fatalf("expected u1 to exist")
	}

	// Inserting u3 (100 bytes) pushes total to 300 > 250, evicting u2 (not u1).
	wall.Set("u3", newClipboard(1, 100))
	if wall.Get("u2") != nil {
		t.Fatalf("expected least-recently-used u2 to be evicted")
	}
	if wall.Get("u1") == nil || wall.Get("u3") == nil {
		t.Fatalf("expected u1 and u3 to remain")
	}
	if wall.UsedBytes() != 200 {
		t.Fatalf("usedBytes = %d, want 200", wall.UsedBytes())
	}
}

func TestWallOverwriteAndOversizedSafety(t *testing.T) {
	w := NewWall(newSilentLogger(), 200)

	w.Set("u1", &gcopy.Clipboard{Index: 1, Data: make([]byte, 120), CreatedAt: time.Now()})
	w.Set("u1", &gcopy.Clipboard{Index: 2, Data: make([]byte, 50), CreatedAt: time.Now()})
	if w.UsedBytes() != 50 {
		t.Fatalf("overwrite usedBytes = %d, want 50", w.UsedBytes())
	}

	// Oversized overwrite on existing key must be rejected without deleting old clipboard.
	w.Set("u1", &gcopy.Clipboard{Index: 3, Data: make([]byte, 250), CreatedAt: time.Now()})
	if got := w.Get("u1"); got == nil || got.Index != 2 {
		t.Fatalf("existing clipboard should remain intact at Index=2 when oversized overwrite is skipped, got %+v", got)
	}

	// Single clipboard exceeding maxBytes on new key is skipped without exceeding cap.
	w.Set("u2", &gcopy.Clipboard{Index: 1, Data: make([]byte, 250), CreatedAt: time.Now()})
	if w.Get("u2") != nil {
		t.Fatalf("oversized clipboard should not be stored")
	}
	if w.UsedBytes() > 200 {
		t.Fatalf("usedBytes = %d exceeded maxBytes 200", w.UsedBytes())
	}
}

func TestWallTTLExpiration(t *testing.T) {
	w := NewWall(newSilentLogger(), 0)
	w.ttl = 50 * time.Millisecond

	w.Set("stale", &gcopy.Clipboard{
		Index:     1,
		Data:      []byte("old"),
		CreatedAt: time.Now().Add(-time.Second),
	})
	w.Set("fresh", &gcopy.Clipboard{
		Index:     1,
		Data:      []byte("new"),
		CreatedAt: time.Now(),
	})

	expired := w.ExpireStale()
	if expired != 1 {
		t.Fatalf("expired = %d, want 1", expired)
	}
	if w.Get("stale") != nil {
		t.Fatalf("expected stale clipboard to be removed")
	}
	if w.Get("fresh") == nil {
		t.Fatalf("expected fresh clipboard to remain")
	}

	// Lazy expiration on Get without calling ExpireStale, plus nil Set no-op and Housekeeping stop.
	w.Set("lazy", &gcopy.Clipboard{
		Index:     1,
		Data:      []byte("lazy"),
		CreatedAt: time.Now().Add(-time.Second),
	})
	w.Set("lazy", nil)
	if w.Get("lazy") != nil {
		t.Fatalf("expected expired clipboard to be evicted lazily on Get")
	}

	stop := w.Housekeeping()
	stop()
}

func TestWallConcurrentAccess(t *testing.T) {
	w := NewWall(newSilentLogger(), 2048)
	var wg sync.WaitGroup

	for i := 0; i < 16; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			for j := 0; j < 50; j++ {
				key := fmt.Sprintf("user-%d", (id+j)%12)
				w.Set(key, &gcopy.Clipboard{
					Index:     j + 1,
					Data:      bytes.Repeat([]byte("x"), 128),
					CreatedAt: time.Now(),
				})
				_ = w.Get(key)
				_ = w.ExpireStale()
			}
		}(i)
	}
	wg.Wait()

	if w.UsedBytes() > 2048 {
		t.Fatalf("concurrent usedBytes = %d exceeded maxBytes 2048", w.UsedBytes())
	}
}
