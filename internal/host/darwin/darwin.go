package darwin

import (
	"bytes"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/llaoj/gcopy/internal/clipboard"
	"github.com/llaoj/gcopy/pkg/utils/file"
	"github.com/llaoj/gcopy/pkg/utils/hash"
)

type HostClipboardManager struct {
	osAScriptPath string
	contentHash   string
}

func NewHostClipboardManager() (*HostClipboardManager, error) {
	path, err := exec.LookPath("osascript")
	if err != nil {
		return nil, err
	}
	return &HostClipboardManager{
		osAScriptPath: path,
	}, nil
}

func clipOutput(output []byte) []byte {
	output = bytes.TrimPrefix(output, []byte("\ufeff"))
	output = bytes.ReplaceAll(output, []byte("\r\n"), []byte("\n"))
	return output
}

func (h *HostClipboardManager) writeTextToFile(file string) error {
	out, err := exec.Command(h.osAScriptPath, "-e the clipboard").CombinedOutput()
	if err != nil {
		return err
	}
	return os.WriteFile(file, clipOutput(out), 0750)
}

func (h *HostClipboardManager) writeScreenshotToFile(file string) error {
	return exec.Command(h.osAScriptPath,
		"-e", "set content to the clipboard as «class PNGf»",
		"-e", "set target to open for access \""+file+"\" with write permission",
		"-e", "set eof of target to 0",
		"-e", "write content to target starting at eof",
		"-e", "close access target").Run()
}

func (h *HostClipboardManager) Get(cb *clipboard.Clipboard) error {
	if cb.ContentFilePath == "" {
		return errors.New("empty ContentFilePath")
	}

	out, err := exec.Command(h.osAScriptPath, "-e", "clipboard info").CombinedOutput()
	if err != nil {
		return err
	}
	lines := bytes.Split(out, []byte("\n"))
	for _, line := range lines {
		if !bytes.Contains(line, []byte("Error")) {
			if bytes.HasPrefix(line, []byte("«class PNGf»")) {
				cb.ContentType = clipboard.ContentTypeScreenshot
			} else if bytes.HasPrefix(line, []byte("«class furl»")) {
				cb.ContentType = clipboard.ContentTypeFile
			} else {
				cb.ContentType = clipboard.ContentTypeText
			}
			break
		}
	}

	contentHash := ""
	switch cb.ContentType {
	case clipboard.ContentTypeText:
		out, err := exec.Command(h.osAScriptPath, "-e the clipboard").CombinedOutput()
		if err != nil {
			return err
		}
		contentHash = hash.HashText(string(out))
	case clipboard.ContentTypeScreenshot:
		out, err := exec.Command(h.osAScriptPath, "-e the clipboard as «class PNGf»").CombinedOutput()
		if err != nil {
			return err
		}
		contentHash = hash.HashText(string(out))
	case clipboard.ContentTypeFile:
		out, err := exec.Command(h.osAScriptPath, "-e", "POSIX path of (the clipboard as «class furl»)").CombinedOutput()
		if err != nil {
			return err
		}
		out = clipOutput(out)
		out = bytes.TrimSuffix(out, []byte("\n"))
		if file.IsDir(string(out)) {
			return errors.New("folders are not supported")
		}
		cb.ContentFilePath = string(out)
		contentHash, err = hash.HashFile(cb.ContentFilePath)
		if err != nil {
			return err
		}
		cb.CopiedFileName = filepath.Base(cb.ContentFilePath)
	}
	cb.ContentHash = contentHash
	if contentHash == "" || contentHash == h.contentHash {
		return nil
	}
	h.contentHash = contentHash

	// save new clipboard content to file
	switch cb.ContentType {
	case clipboard.ContentTypeText:
		return h.writeTextToFile(cb.ContentFilePath)
	case clipboard.ContentTypeScreenshot:
		return h.writeScreenshotToFile(cb.ContentFilePath)
	}

	return nil
}

func (h *HostClipboardManager) Set(cb *clipboard.Clipboard) error {
	switch cb.ContentType {
	case clipboard.ContentTypeScreenshot:
		cmd := fmt.Sprintf("-e set the clipboard to (read \"%s\" as «class PNGf»)", cb.ContentFilePath)
		return exec.Command(h.osAScriptPath, cmd).Run()
	case clipboard.ContentTypeFile:
		cacheDir := fmt.Sprintf("%s/cache/", filepath.Dir(cb.ContentFilePath))
		err := os.RemoveAll(cacheDir)
		if err != nil {
			return err
		}
		tmpFile := cacheDir + cb.CopiedFileName
		_, err = file.CopyFile(cb.ContentFilePath, tmpFile)
		if err != nil {
			return err
		}
		cmd := fmt.Sprintf("-e set the clipboard to (POSIX file \"%s\")", tmpFile)
		return exec.Command(h.osAScriptPath, cmd).Run()
	default:
		cmd := fmt.Sprintf("set the clipboard to (read \"%s\" as «class utf8»)", cb.ContentFilePath)
		return exec.Command(h.osAScriptPath, "-e", cmd).Run()
	}
}
