package darwin

import (
	"os"
	"testing"

	"github.com/llaoj/gcopy/internal/gcopy"
	"github.com/llaoj/gcopy/internal/host"
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
	hcb := host.HostClipboard{
		FilePath: "/Users/weiyangwang/.gcopy/client/content",
	}
	err = h.Get(&hcb)
	if err != nil {
		t.Errorf("%s", err)
	}
	t.Logf("%+v", hcb)

	// SET
	hcb = host.HostClipboard{
		Clipboard: &gcopy.Clipboard{
			Type:     gcopy.TypeFile,
			FileName: "老 J.png",
		},
		FilePath: "/Users/weiyangwang/.gcopy/client/content",
	}
	err = h.Set(&hcb)
	if err != nil {
		t.Errorf("%s", err)
	}
	t.Log("clipboard set success")
}
