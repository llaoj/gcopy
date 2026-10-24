package utils

import "testing"

func TestHashID(t *testing.T) {
	first := HashID("secret", "ABC12345")
	second := HashID("secret", "ABC12345")
	otherSecret := HashID("other-secret", "ABC12345")

	if first != second {
		t.Fatalf("HashID is not stable: %q != %q", first, second)
	}
	if first == otherSecret {
		t.Fatalf("HashID should depend on the secret")
	}
	if len(first) != 16 {
		t.Fatalf("HashID length = %d, want 16", len(first))
	}
	if first == "ABC12345" {
		t.Fatalf("HashID must not return the raw id")
	}
}
