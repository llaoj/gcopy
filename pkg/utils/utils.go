package utils

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
)

// HashID returns a stable, pseudonymous identifier for id using secret.
func HashID(secret, id string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(id))
	return hex.EncodeToString(mac.Sum(nil))[:16]
}
