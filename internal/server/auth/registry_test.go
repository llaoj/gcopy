package auth

import (
	"testing"
	"time"
)

func TestTokenRegistryReserveUniqueness(t *testing.T) {
	var r tokenRegistry

	const n = 1000
	seen := make(map[string]bool)
	for i := 0; i < n; i++ {
		token, err := r.reserve()
		if err != nil {
			t.Fatalf("reserve() error = %v", err)
		}
		if seen[token] {
			t.Fatalf("reserve() returned duplicate token: %s", token)
		}
		seen[token] = true
		if !tokenPattern.MatchString(token) {
			t.Fatalf("reserve() returned invalid token: %s", token)
		}
	}
}

func TestTokenRegistrySweepExpired(t *testing.T) {
	var r tokenRegistry
	now := time.Now()

	r.tokens.Store("EXPIRED1", now.Add(-tokenTTL-time.Second))
	r.tokens.Store("ACTIVE01", now.Add(-time.Hour))

	r.sweepExpired(now)

	if _, exists := r.tokens.Load("EXPIRED1"); exists {
		t.Fatal("expected EXPIRED1 reservation to be swept")
	}
	if _, exists := r.tokens.Load("ACTIVE01"); !exists {
		t.Fatal("expected ACTIVE01 reservation to remain")
	}
}
