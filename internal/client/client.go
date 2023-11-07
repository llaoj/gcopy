package client

import (
	"bytes"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"sync"
	"time"

	"github.com/sirupsen/logrus"

	"github.com/llaoj/gcopy/internal/clipboard"
	"github.com/llaoj/gcopy/internal/config"
	"github.com/llaoj/gcopy/internal/host"
	"github.com/llaoj/gcopy/internal/host/darwin"
	"github.com/llaoj/gcopy/internal/host/windows"
)

var (
	StoragePath           string
	HostContentFilePath   string
	ServerContentFilePath string
)

type Client struct {
	cb                   *clipboard.Clipboard
	serverCb             *clipboard.Clipboard
	hostClipboardManager host.HostClipboardManager
	log                  *logrus.Entry
}

func NewClient(log *logrus.Logger) (*Client, error) {
	c := &Client{cb: &clipboard.Clipboard{}}
	c.log = log.WithField("role", "client")

	userHomeDir, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}
	StoragePath = userHomeDir

	switch os := runtime.GOOS; os {
	case "darwin":
		StoragePath += "/.gcopy/client/"
		hostClipboardManager, err := darwin.NewHostClipboardManager()
		if err != nil {
			return nil, err
		}
		c.hostClipboardManager = hostClipboardManager
	case "windows":
		StoragePath += "\\.gcopy\\client\\"
		hostClipboardManager, err := windows.NewHostClipboardManager()
		if err != nil {
			return nil, err
		}
		c.hostClipboardManager = hostClipboardManager
	default:
		c.log.Fatal("unsupported os")
	}
	HostContentFilePath = StoragePath + "host"
	ServerContentFilePath = StoragePath + "server"

	if err := os.MkdirAll(StoragePath, 0750); err != nil {
		return nil, err
	}

	return c, nil
}

func (c *Client) Run(wg *sync.WaitGroup) {
	defer wg.Done()

	go c.watchServerClipboard()

	for {
		// pull latest clipboard from server
		// set if clipboard changed
		if err := c.getServerClipboard(); err != nil {
			c.log.Error(err)
		}

		// get the current clipboard(local)
		// upload if changed
		if err := c.updateServerClipboard(); err != nil {
			c.log.Error(err)
		}

		time.Sleep(time.Second)
	}
}

func (c *Client) watchServerClipboard() {
	c.log.Debug("requesting server clipboard")
	cfg := config.Get()

	for {
		index := c.cb.Index
		if c.serverCb != nil {
			index = c.serverCb.Index
		}
		url := fmt.Sprintf("http://%s/apis/v1/clipboard?token=%s&index=%v", cfg.Server, cfg.Token, index)
		resp, err := http.Get(url)
		if err != nil {
			c.log.Error(err)
			continue
		}

		// timeout or something
		if resp.StatusCode != http.StatusOK {
			continue
		}

		index, _ = strconv.Atoi(resp.Header.Get("X-Index"))
		if index == 0 || index == c.cb.Index {
			continue
		}

		contentType := resp.Header.Get("X-Content-Type")
		copiedFileName := resp.Header.Get("X-Copied-File-Name")
		if contentType == "" || (contentType == clipboard.ContentTypeFile && copiedFileName == "") {
			c.log.Error(err)
			continue
		}

		file, err := os.OpenFile(ServerContentFilePath, os.O_CREATE|os.O_TRUNC|os.O_RDWR, 0644)
		if err != nil {
			c.log.Error(err)
			continue
		}
		if _, err := io.Copy(file, resp.Body); err != nil {
			c.log.Error(err)
			continue
		}
		file.Close()
		resp.Body.Close()
		c.serverCb = &clipboard.Clipboard{
			Index:           index,
			ContentType:     contentType,
			ContentFilePath: ServerContentFilePath,
			CopiedFileName:  copiedFileName,
		}
		c.log.Debugf("downloaded new server content: %+v", c.serverCb)
	}
}

func (c *Client) getServerClipboard() error {
	if c.serverCb == nil {
		return nil
	}

	if err := c.hostClipboardManager.Set(c.serverCb); err != nil {
		return err
	}
	c.cb = c.serverCb
	c.serverCb = nil

	return nil
}

func (c *Client) updateServerClipboard() error {
	cfg := config.Get()
	client := http.DefaultClient

	out := clipboard.Clipboard{ContentFilePath: HostContentFilePath}
	if err := c.hostClipboardManager.Get(&out); err != nil {
		return err
	}

	if c.cb.ContentHash == "" {
		c.cb.ContentHash = out.ContentHash
		return nil
	}

	if out.ContentHash == c.cb.ContentHash {
		return nil
	}

	url := fmt.Sprintf("http://%s/apis/v1/clipboard?token=%s", cfg.Server, cfg.Token)
	req, err := fileUploadRequest(url, out.ContentFilePath)
	if err != nil {
		return err
	}
	req.Header.Set("X-Content-Type", out.ContentType)
	req.Header.Set("X-Copied-File-Name", out.CopiedFileName)
	resp, err := client.Do(req)
	if err != nil {
		return err
	}

	if resp.StatusCode != http.StatusOK {
		defer resp.Body.Close()
		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return err
		}
		c.log.Warnf("new host clipboard upload failed: %s", body)
	}

	// update the clipboard index
	index, _ := strconv.Atoi(resp.Header.Get("X-Index"))
	out.Index = index
	c.cb = &out
	c.log.Debugf("new host clipboard uploaded, current: %+v", c.cb)

	return nil
}

func fileUploadRequest(url string, path string) (*http.Request, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("f", filepath.Base(path))
	if err != nil {
		return nil, err
	}
	if _, err = io.Copy(part, file); err != nil {
		return nil, err
	}

	if err := writer.Close(); err != nil {
		return nil, err
	}

	req, err := http.NewRequest(http.MethodPost, url, body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())
	return req, nil
}
