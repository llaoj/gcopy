package server

import (
	"testing"
)

func TestGenerateToken(t *testing.T) {
	token, err := generateToken()
	if err != nil {
		t.Fatalf("generateToken() error = %v", err)
	}
	if len(token) != 6 {
		t.Errorf("generateToken() token length = %v, want 6", len(token))
	}

	// Check that token only contains valid characters
	const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
	for _, c := range token {
		found := false
		for _, valid := range charset {
			if c == valid {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("generateToken() token contains invalid character %c", c)
		}
	}

	// Generate multiple tokens to check for uniqueness
	tokens := make(map[string]bool)
	for i := 0; i < 100; i++ {
		token, err := generateToken()
		if err != nil {
			t.Fatalf("generateToken() error = %v", err)
		}
		if tokens[token] {
			t.Logf("Warning: duplicate token generated (this is very rare but possible): %s", token)
		}
		tokens[token] = true
	}
}

func TestGenerateTokenUniqueness(t *testing.T) {
	// Generate 1000 tokens and check for duplicates
	tokens := make(map[string]bool)
	duplicates := 0

	for i := 0; i < 1000; i++ {
		token, err := generateToken()
		if err != nil {
			t.Fatalf("generateToken() error = %v", err)
		}
		if tokens[token] {
			duplicates++
		}
		tokens[token] = true
	}

	// With 62^6 possible combinations, duplicates should be extremely rare
	// We allow up to 1 duplicate as an acceptable threshold
	if duplicates > 1 {
		t.Errorf("Too many duplicate tokens generated: %d", duplicates)
	}
}
