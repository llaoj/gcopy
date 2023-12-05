package windows

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
	powershellPath string
	contentHash    string
}

func NewHostClipboardManager() (*HostClipboardManager, error) {
	path, err := exec.LookPath("powershell")
	if err != nil {
		return nil, err
	}
	return &HostClipboardManager{
		powershellPath: path,
	}, nil
}

func clipOutput(output []byte) []byte {
	// remove BOM Header
	output = bytes.TrimPrefix(output, []byte("\ufeff"))
	// remove last line
	output = bytes.TrimSuffix(output, []byte("\r\n"))
	// CRLF to LF
	output = bytes.ReplaceAll(output, []byte("\r\n"), []byte("\n"))
	return output
}

func (h *HostClipboardManager) getContentType() (string, error) {
	out, err := exec.Command(h.powershellPath, "-Command", "(Get-Clipboard -Raw) -ne $null").CombinedOutput()
	if err != nil {
		return "", err
	}
	if bytes.HasPrefix(out, []byte("True")) {
		return gcopy.TypeText, nil
	}

	out, err = exec.Command(h.powershellPath, "-Command", "(Get-Clipboard -Format Image) -ne $null").CombinedOutput()
	if err != nil {
		return "", err
	}
	if bytes.HasPrefix(out, []byte("True")) {
		return gcopy.TypeScreenshot, nil
	}

	out, err = exec.Command(h.powershellPath, "-Command", "(Get-Clipboard -Format FileDropList) -ne $null").CombinedOutput()
	if err != nil {
		return "", err
	}
	if !bytes.HasPrefix(out, []byte("False")) {
		return gcopy.TypeFile, nil
	}

	return "", nil
}

func (h *HostClipboardManager) Get(hcb *host.HostClipboard) error {
	contentType, err := h.getContentType()
	if err != nil {
		return err
	}
	if contentType == "" {
		return errors.New("the host clipboard is null")
	}
	hcb.Type = contentType

	contentHash := ""
	switch hcb.Type {
	case gcopy.TypeText:
		out, err := exec.Command(h.powershellPath, "-Command", "Get-Clipboard -Raw").CombinedOutput()
		if err != nil {
			return err
		}
		contentHash = hash.HashText(string(out))
	case gcopy.TypeScreenshot:
		cmd := "$ms = New-Object System.IO.MemoryStream; (Get-Clipboard -Format Image).Save($ms, [System.Drawing.Imaging.ImageFormat]::Png); $ms.ToArray() -join \"\""
		out, err := exec.Command(h.powershellPath, "-Command", cmd).CombinedOutput()
		if err != nil {
			return fmt.Errorf("%s: %s", err, out)
		}
		contentHash = hash.HashText(string(out))
	case gcopy.TypeFile:
		cmd := fmt.Sprintf("Set-Content -Encoding utf8 -Path \"%s\" -Value ((Get-Clipboard -Format FileDropList)[0].FullName)", hcb.FilePath)
		out, err := exec.Command(h.powershellPath, "-Command", cmd).CombinedOutput()
		if err != nil {
			return fmt.Errorf("%s: %s", err, out)
		}
		out, err = os.ReadFile(hcb.FilePath)
		if err != nil {
			return err
		}
		out = clipOutput(out)
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

	switch hcb.Type {
	case gcopy.TypeText:
		cmd := fmt.Sprintf("Set-Content -Encoding utf8 -Path \"%s\" -Value (Get-Clipboard -Raw)", hcb.FilePath)
		out, err := exec.Command(h.powershellPath, "-Command", cmd).CombinedOutput()
		if err != nil {
			return fmt.Errorf("%s: %s", err, out)
		}
		output, err := os.ReadFile(hcb.FilePath)
		if err != nil {
			return err
		}
		return os.WriteFile(hcb.FilePath, clipOutput(output), os.ModePerm)
	case gcopy.TypeScreenshot:
		cmd := fmt.Sprintf("(Get-CLipboard -Format Image).Save(\"%s\")", hcb.FilePath)
		out, err := exec.Command(h.powershellPath, "-Command", cmd).CombinedOutput()
		if err != nil {
			return fmt.Errorf("%s: %s", err, out)
		}
		return nil
	}

	return nil
}

func (h *HostClipboardManager) Set(hcb *host.HostClipboard) error {
	if hcb.Type == gcopy.TypeText {
		cmd := fmt.Sprintf("Set-Clipboard -Value (Get-Content -Encoding utf8 -Path \"%s\")", hcb.FilePath)
		out, err := exec.Command(h.powershellPath, "-Command", cmd).CombinedOutput()
		if err != nil {
			return fmt.Errorf("%s: %s", err, out)
		}
		return nil
	}

	if hcb.Type == gcopy.TypeScreenshot {
		cmd := fmt.Sprintf("Add-Type -Assembly System.Windows.Forms, System.Drawing; [System.Windows.Forms.Clipboard]::SetImage([System.Drawing.Image]::FromFile(\"%s\"))", hcb.FilePath)
		out, err := exec.Command(h.powershellPath, "-Command", cmd).CombinedOutput()
		if err != nil {
			return fmt.Errorf("%s: %s", err, out)
		}
		return nil
	}

	if hcb.Type == gcopy.TypeFile {
		cacheDir := fmt.Sprintf("%s\\cache\\", filepath.Dir(hcb.FilePath))
		if err := os.RemoveAll(cacheDir); err != nil {
			return err
		}
		tmpFile := cacheDir + hcb.FileName
		if _, err := file.CopyFile(hcb.FilePath, tmpFile); err != nil {
			return err
		}
		out, err := exec.Command(h.powershellPath, "-Command", "Set-Clipboard -Path \""+tmpFile+"\"").CombinedOutput()
		if err != nil {
			return fmt.Errorf("%s: %s", err, out)
		}
		return nil
	}

	return nil
}
