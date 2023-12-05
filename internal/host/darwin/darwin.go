package darwin

import (
	"bytes"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/llaoj/gcopy/internal/gcopy"
	"github.com/llaoj/gcopy/internal/host"
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

func (h *HostClipboardManager) Get(hcb *host.HostClipboard) error {
	if hcb.FilePath == "" {
		return errors.New("empty FilePath")
	}

	out, err := exec.Command(h.osAScriptPath, "-e", "clipboard info").CombinedOutput()
	if err != nil {
		return err
	}
	lines := bytes.Split(out, []byte("\n"))
	for _, line := range lines {
		if !bytes.Contains(line, []byte("Error")) {
			if bytes.HasPrefix(line, []byte("«class PNGf»")) {
				hcb.Type = gcopy.TypeScreenshot
			} else if bytes.HasPrefix(line, []byte("«class furl»")) {
				hcb.Type = gcopy.TypeFile
			} else {
				hcb.Type = gcopy.TypeText
			}
			break
		}
	}

	contentHash := ""
	switch hcb.Type {
	case gcopy.TypeText:
		out, err := exec.Command(h.osAScriptPath, "-e the clipboard").CombinedOutput()
		if err != nil {
			return err
		}
		contentHash = hash.HashText(string(out))
	case gcopy.TypeScreenshot:
		out, err := exec.Command(h.osAScriptPath, "-e the clipboard as «class PNGf»").CombinedOutput()
		if err != nil {
			return err
		}
		contentHash = hash.HashText(string(out))
	case gcopy.TypeFile:
		out, err := exec.Command(h.osAScriptPath, "-e", "POSIX path of (the clipboard as «class furl»)").CombinedOutput()
		if err != nil {
			return err
		}
		out = clipOutput(out)
		out = bytes.TrimSuffix(out, []byte("\n"))
		if file.IsDir(string(out)) {
			return errors.New("folders are not supported")
		}
		hcb.FilePath = string(out)
		contentHash, err = hash.HashFile(hcb.FilePath)
		if err != nil {
			return err
		}
		hcb.FileName = filepath.Base(hcb.FilePath)
	}
	hcb.Hash = contentHash
	if contentHash == "" || contentHash == h.contentHash {
		return nil
	}
	h.contentHash = contentHash

	// save new clipboard content to file
	switch hcb.Type {
	case gcopy.TypeText:
		return h.writeTextToFile(hcb.FilePath)
	case gcopy.TypeScreenshot:
		return h.writeScreenshotToFile(hcb.FilePath)
	}

	return nil
}

func (h *HostClipboardManager) Set(hcb *host.HostClipboard) error {
	switch hcb.Type {
	case gcopy.TypeScreenshot:
		cmd := fmt.Sprintf("set the clipboard to (read \"%s\" as «class PNGf»)", hcb.FilePath)
		out, err := exec.Command(h.osAScriptPath, "-e", cmd).CombinedOutput()
		if err != nil {
			return fmt.Errorf("%s: %s", err, out)
		}
		return nil
	case gcopy.TypeFile:
		cacheDir := fmt.Sprintf("%s/cache/", filepath.Dir(hcb.FilePath))
		err := os.RemoveAll(cacheDir)
		if err != nil {
			return err
		}
		tmpFile := cacheDir + hcb.FileName
		_, err = file.CopyFile(hcb.FilePath, tmpFile)
		if err != nil {
			return err
		}
		cmd := fmt.Sprintf("set the clipboard to (POSIX file \"%s\")", tmpFile)
		out, err := exec.Command(h.osAScriptPath, "-e", cmd).CombinedOutput()
		if err != nil {
			return fmt.Errorf("%s: %s", err, out)
		}
		return nil
	case gcopy.TypeText:
		cmd := fmt.Sprintf("set the clipboard to (read \"%s\" as «class utf8»)", hcb.FilePath)
		out, err := exec.Command(h.osAScriptPath, "-e", cmd).CombinedOutput()
		if err != nil {
			return fmt.Errorf("%s: %s", err, out)
		}
		return nil
	}
	return fmt.Errorf("unspported clipboard type")
}
