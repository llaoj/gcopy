package auth

import (
	"testing"
)

func TestGenerateToken(t *testing.T) {
	token, err := generateToken()
	if err != nil {
		t.Fatalf("generateToken() error = %v", err)
	}
	if len(token) != TokenLength {
		t.Errorf("generateToken() token length = %v, want %d", len(token), TokenLength)
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

	// With 62^8 possible combinations, duplicates should be effectively impossible
	if duplicates > 0 {
		t.Errorf("Duplicate tokens generated: %d", duplicates)
	}
}

func TestExtractBearerToken(t *testing.T) {
	tests := []struct {
		header string
		want   string
		ok     bool
	}{
		{"Bearer G8K2P9X4", "G8K2P9X4", true},
		{"bearer aBcD1234", "aBcD1234", true},
		{"Bearer   Z9y8X7w6  ", "Z9y8X7w6", true},
		{"Bearer short", "", false},
		{"Bearer toolong123", "", false},
		{"Bearer bad-char", "", false},
		{"Basic G8K2P9X4", "", false},
		{"", "", false},
	}

	for _, tt := range tests {
		got, ok := ExtractBearerToken(tt.header)
		if ok != tt.ok || got != tt.want {
			t.Errorf("ExtractBearerToken(%q) = (%q, %v), want (%q, %v)", tt.header, got, ok, tt.want, tt.ok)
		}
	}
}
