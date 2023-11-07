package windows

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
	// cb := clipboard.Clipboard{
	// 	ContentFilePath: "D:\\proj\\gcopy-v2\\.gcopy\\content",
	// }
	// err = h.Get(&cb)
	// if err != nil {
	// 	t.Errorf("%s", err)
	// }
	// t.Logf("%+v", cb)

	cb := &clipboard.Clipboard{
		ContentType:     clipboard.ContentTypeFile,
		ContentFilePath: "D:\\proj\\gcopy-v2\\.gcopy\\content",
		CopiedFileName:  "缘 分.txt",
	}
	err = h.Set(cb)
	if err != nil {
		t.Errorf("%s", err)
	}
	t.Log("clipboard set success")
}
