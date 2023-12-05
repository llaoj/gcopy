package host

import (
	"github.com/llaoj/gcopy/internal/gcopy"
)

type HostClipboard struct {
	*gcopy.Clipboard
	// Hash of content
	Hash string
	// The clipboard content store in this File
	FilePath string
}

type HostClipboardManager interface {
	Get(*HostClipboard) error
	Set(*HostClipboard) error
}
