package darwin

import (
	"os"
	"testing"

	"github.com/llaoj/gcopy/internal/clipboard"
	log "github.com/sirupsen/logrus"
)

func TestClipboard(t *testing.T) {
	log.SetOutput(os.Stdout)
	log.SetLevel(log.TraceLevel)

	h, err := NewHostClipboardManager()
	if err != nil {
		t.Error(err)
	}

	// GET
	cb := clipboard.Clipboard{
		ContentFilePath: "/Users/weiyangwang/.gcopy/client/content",
	}
	err = h.Get(&cb)
	if err != nil {
		t.Errorf("%s", err)
	}
	t.Logf("%+v", cb)

	// SET
	cb = clipboard.Clipboard{
		ContentType:     clipboard.ContentTypeFile,
		ContentFilePath: "/Users/weiyangwang/.gcopy/client/content",
		CopiedFileName:  "老 J.png",
	}
	err = h.Set(&cb)
	if err != nil {
		t.Errorf("%s", err)
	}
	t.Log("clipboard set success")
}
