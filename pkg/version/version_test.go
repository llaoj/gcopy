package version

import "testing"

func TestVersion(t *testing.T) {
	if got := Version(); got == "" {
		t.Fatal("Version() should not be empty")
	}
	PrintVersion()
}
