package auth

import (
	"testing"
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
