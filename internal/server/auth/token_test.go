package auth

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/sessions"
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

func TestValidateTokenFormat(t *testing.T) {
	valid := []string{"G8K2P9X4", "abcdefgh", "12345678", "Zz09Aa12"}
	for _, token := range valid {
		if err := ValidateTokenFormat(token); err != nil {
			t.Errorf("ValidateTokenFormat(%q) unexpected error: %v", token, err)
		}
	}

	invalid := []string{"", "short77", "toolong89", "bad-char", "bad char", "中文123456"}
	for _, token := range invalid {
		if err := ValidateTokenFormat(token); err == nil {
			t.Errorf("ValidateTokenFormat(%q) expected error, got nil", token)
		}
	}
}

func TestTokenAuthGenerateAndVerifyRoutes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	store := sessions.NewCookieStore([]byte("test-secret-key-16"))
	tokenAuth := NewTokenAuth(store)

	router := gin.New()
	v1 := router.Group("/api/v1")
	tokenAuth.RegisterRoutes(v1)

	// 1. Generate a new token and verify session cookie is issued.
	recGen := httptest.NewRecorder()
	reqGen := httptest.NewRequest(http.MethodPost, "/api/v1/user/token/generate", nil)
	router.ServeHTTP(recGen, reqGen)
	if recGen.Code != http.StatusOK {
		t.Fatalf("generate status = %d, body = %s", recGen.Code, recGen.Body.String())
	}

	var genResp struct {
		UserID string `json:"userId"`
	}
	if err := json.Unmarshal(recGen.Body.Bytes(), &genResp); err != nil {
		t.Fatalf("decode generate response: %v", err)
	}
	if err := ValidateTokenFormat(genResp.UserID); err != nil {
		t.Fatalf("generated userId %q invalid: %v", genResp.UserID, err)
	}
	if len(recGen.Result().Cookies()) == 0 {
		t.Fatal("expected session cookie on token generate")
	}

	// 2. Verify an existing valid token.
	recVerify := httptest.NewRecorder()
	reqVerify := httptest.NewRequest(
		http.MethodPost,
		"/api/v1/user/token/verify",
		strings.NewReader(`{"token":"AbCd1234"}`),
	)
	reqVerify.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(recVerify, reqVerify)
	if recVerify.Code != http.StatusOK {
		t.Fatalf("verify status = %d, body = %s", recVerify.Code, recVerify.Body.String())
	}

	reqCheck := httptest.NewRequest(http.MethodGet, "/", nil)
	for _, cookie := range recVerify.Result().Cookies() {
		reqCheck.AddCookie(cookie)
	}
	session, err := GetSession(store, reqCheck, UserSessionName)
	if err != nil || !IsAuthenticated(session) {
		t.Fatalf("expected verified session to be authenticated, err=%v", err)
	}
	if userID, _ := GetUserIDFromSession(session); userID != "AbCd1234" {
		t.Fatalf("session userID = %q, want AbCd1234", userID)
	}

	// 3. Reject wrong-length token with 422.
	recShort := httptest.NewRecorder()
	reqShort := httptest.NewRequest(
		http.MethodPost,
		"/api/v1/user/token/verify",
		strings.NewReader(`{"token":"short"}`),
	)
	reqShort.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(recShort, reqShort)
	if recShort.Code != http.StatusUnprocessableEntity {
		t.Fatalf("short token status = %d, want 422", recShort.Code)
	}

	// 4. Reject 8-char non-alphanumeric token with 400.
	recBadChars := httptest.NewRecorder()
	reqBadChars := httptest.NewRequest(
		http.MethodPost,
		"/api/v1/user/token/verify",
		strings.NewReader(`{"token":"bad-char"}`),
	)
	reqBadChars.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(recBadChars, reqBadChars)
	if recBadChars.Code != http.StatusBadRequest {
		t.Fatalf("bad-char token status = %d, want 400", recBadChars.Code)
	}
}
