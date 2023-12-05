package windows

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
	// cb := clipboard.Clipboard{
	// 	ContentFilePath: "D:\\proj\\gcopy-v2\\.gcopy\\content",
	// }
	// err = h.Get(&cb)
	// if err != nil {
	// 	t.Errorf("%s", err)
	// }
	// t.Logf("%+v", cb)

	hcb := &host.HostClipboard{
		Clipboard: &gcopy.Clipboard{
			Type:     gcopy.TypeFile,
			FileName: "缘 分.txt",
		},
		FilePath: "D:\\proj\\gcopy-v2\\.gcopy\\content",
	}
	err = h.Set(hcb)
	if err != nil {
		t.Errorf("%s", err)
	}
	t.Log("clipboard set success")
}
