package auth

import (
	"testing"

	"github.com/gorilla/sessions"
)

func TestGetUserIdFromSession(t *testing.T) {
	tests := []struct {
		name   string
		userId string
		wantOK bool
	}{
		{name: "token", userId: "ABC12345", wantOK: true},
		{name: "legacy non-token", userId: "user@example.com", wantOK: false},
		{name: "empty", userId: "", wantOK: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			session := &sessions.Session{
				Values: map[interface{}]interface{}{
					"userId":   tt.userId,
					"loggedIn": true,
				},
			}

			userId, ok := GetUserIdFromSession(session)
			if ok != tt.wantOK {
				t.Fatalf("GetUserIdFromSession ok = %v, want %v", ok, tt.wantOK)
			}
			if ok && userId != tt.userId {
				t.Fatalf("userId = %q, want %q", userId, tt.userId)
			}
			if IsAuthenticated(session) != tt.wantOK {
				t.Fatalf("IsAuthenticated = %v, want %v", IsAuthenticated(session), tt.wantOK)
			}
		})
	}
}
