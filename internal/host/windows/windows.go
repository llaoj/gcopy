package windows

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
		return clipboard.ContentTypeText, nil
	}

	out, err = exec.Command(h.powershellPath, "-Command", "(Get-Clipboard -Format Image) -ne $null").CombinedOutput()
	if err != nil {
		return "", err
	}
	if bytes.HasPrefix(out, []byte("True")) {
		return clipboard.ContentTypeScreenshot, nil
	}

	out, err = exec.Command(h.powershellPath, "-Command", "(Get-Clipboard -Format FileDropList) -ne $null").CombinedOutput()
	if err != nil {
		return "", err
	}
	if !bytes.HasPrefix(out, []byte("False")) {
		return clipboard.ContentTypeFile, nil
	}

	return "", nil
}

func (h *HostClipboardManager) Get(cb *clipboard.Clipboard) error {
	contentType, err := h.getContentType()
	if err != nil {
		return err
	}
	if contentType == "" {
		return errors.New("the host clipboard is null")
	}
	cb.ContentType = contentType

	contentHash := ""
	switch cb.ContentType {
	case clipboard.ContentTypeText:
		out, err := exec.Command(h.powershellPath, "-Command", "Get-Clipboard -Raw").CombinedOutput()
		if err != nil {
			return err
		}
		contentHash = hash.HashText(string(out))
	case clipboard.ContentTypeScreenshot:
		cmd := "$ms = New-Object System.IO.MemoryStream; (Get-Clipboard -Format Image).Save($ms, [System.Drawing.Imaging.ImageFormat]::Png); $ms.ToArray() -join \"\""
		out, err := exec.Command(h.powershellPath, "-Command", cmd).CombinedOutput()
		if err != nil {
			return err
		}
		contentHash = hash.HashText(string(out))
	case clipboard.ContentTypeFile:
		cmd := fmt.Sprintf("Set-Content -Encoding utf8 -Path \"%s\" -Value ((Get-Clipboard -Format FileDropList)[0].FullName)", cb.ContentFilePath)
		if err := exec.Command(h.powershellPath, "-Command", cmd).Run(); err != nil {
			return err
		}
		out, err := os.ReadFile(cb.ContentFilePath)
		if err != nil {
			return err
		}
		out = clipOutput(out)
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

	switch cb.ContentType {
	case clipboard.ContentTypeText:
		cmd := fmt.Sprintf("Set-Content -Encoding utf8 -Path \"%s\" -Value (Get-Clipboard -Raw)", cb.ContentFilePath)
		if err := exec.Command(h.powershellPath, "-Command", cmd).Run(); err != nil {
			return err
		}
		output, err := os.ReadFile(cb.ContentFilePath)
		if err != nil {
			return err
		}
		return os.WriteFile(cb.ContentFilePath, clipOutput(output), os.ModePerm)
	case clipboard.ContentTypeScreenshot:
		cmd := fmt.Sprintf("(Get-CLipboard -Format Image).Save(\"%s\")", cb.ContentFilePath)
		return exec.Command(h.powershellPath, "-Command", cmd).Run()
	}

	return nil
}

func (h *HostClipboardManager) Set(cb *clipboard.Clipboard) error {
	if cb.ContentType == clipboard.ContentTypeText {
		cmd := fmt.Sprintf("Set-Clipboard -Value (Get-Content -Encoding utf8 -Path \"%s\")", cb.ContentFilePath)
		return exec.Command(h.powershellPath, "-Command", cmd).Run()
	}

	if cb.ContentType == clipboard.ContentTypeScreenshot {
		cmd := fmt.Sprintf("Add-Type -Assembly System.Windows.Forms, System.Drawing; [System.Windows.Forms.Clipboard]::SetImage([System.Drawing.Image]::FromFile(\"%s\"))", cb.ContentFilePath)
		return exec.Command(h.powershellPath, "-Command", cmd).Run()
	}

	if cb.ContentType == clipboard.ContentTypeFile {
		cacheDir := fmt.Sprintf("%s\\cache\\", filepath.Dir(cb.ContentFilePath))
		if err := os.RemoveAll(cacheDir); err != nil {
			return err
		}
		tmpFile := cacheDir + cb.CopiedFileName
		if _, err := file.CopyFile(cb.ContentFilePath, tmpFile); err != nil {
			return err
		}
		return exec.Command(h.powershellPath, "-Command", "Set-Clipboard -Path \""+tmpFile+"\"").Run()
	}

	return nil
}
