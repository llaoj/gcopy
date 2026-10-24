package log

import (
	"bytes"
	"strings"
	"testing"

	"github.com/llaoj/gcopy/pkg/utils"
	"github.com/sirupsen/logrus"
)

func TestAnalytics(t *testing.T) {
	var output bytes.Buffer
	base := logrus.New()
	base.SetOutput(&output)
	base.SetFormatter(&logrus.TextFormatter{
		DisableColors:    true,
		DisableTimestamp: true,
	})

	logger := New(base, "test-app-key")
	logger.Analytics("sync_upload", "ABC12345", logrus.Fields{
		"type":  "text",
		"index": 3,
	})

	line := output.String()
	expectedUser := utils.HashID("test-app-key", "ABC12345")
	for _, want := range []string{
		"msg=ANALYTICS",
		"event=sync_upload",
		"type=text",
		"index=3",
		"user=" + expectedUser,
	} {
		if !strings.Contains(line, want) {
			t.Fatalf("analytics log %q does not contain %q", line, want)
		}
	}
	if strings.Contains(line, "ABC12345") {
		t.Fatalf("analytics log must not contain the raw token: %q", line)
	}
}
