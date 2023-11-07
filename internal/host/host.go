package host

import "github.com/llaoj/gcopy/internal/clipboard"

type HostClipboardManager interface {
	Get(*clipboard.Clipboard) error
	Set(*clipboard.Clipboard) error
}
