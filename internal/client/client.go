package client

import (
	"bytes"
	"crypto/tls"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"runtime"
	"strconv"
	"sync"
	"time"

	"github.com/sirupsen/logrus"

	"github.com/llaoj/gcopy/internal/config"
	"github.com/llaoj/gcopy/internal/gcopy"
	"github.com/llaoj/gcopy/internal/host"
	"github.com/llaoj/gcopy/internal/host/darwin"
	"github.com/llaoj/gcopy/internal/host/windows"
	"github.com/llaoj/gcopy/pkg/utils/file"
)

var (
	StoragePath  string
	DataFilePath string
)

type Client struct {
	cli *http.Client
	log *logrus.Entry

	mgr host.HostClipboardManager
	hcb *host.HostClipboard
}

func NewClient(log *logrus.Logger) (*Client, error) {
	cfg := config.Get()
	c := &Client{
		log: log.WithField("role", "client"),
		hcb: &host.HostClipboard{
			Clipboard: &gcopy.Clipboard{},
		},
		cli: &http.Client{
			Timeout: time.Minute,
		},
	}
	if cfg.InsecureSkipVerify {
		c.cli.Transport = &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		}
	}

	userHomeDir, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}
	StoragePath = userHomeDir

	switch os := runtime.GOOS; os {
	case "darwin":
		StoragePath += "/.gcopy/client/"
		mgr, err := darwin.NewHostClipboardManager()
		if err != nil {
			return nil, err
		}
		c.mgr = mgr
	case "windows":
		StoragePath += "\\.gcopy\\client\\"
		mgr, err := windows.NewHostClipboardManager()
		if err != nil {
			return nil, err
		}
		c.mgr = mgr
	default:
		c.log.Fatal("unsupported os")
	}
	DataFilePath = StoragePath + "content"
	if err := os.MkdirAll(StoragePath, 0750); err != nil {
		return nil, err
	}

	return c, nil
}

func (c *Client) Run(wg *sync.WaitGroup) {
	defer wg.Done()

	for {
		if err := c.pullClipboard(); err != nil {
			c.log.Error(err)
		}

		if err := c.pushClipboard(); err != nil {
			c.log.Error(err)
		}

		time.Sleep(time.Second)
	}
}

func (c *Client) pullClipboard() error {
	cfg := config.Get()
	req, err := http.NewRequest(http.MethodGet, config.Get().Server+"/clipboard", nil)
	if err != nil {
		return err
	}
	req.SetBasicAuth(cfg.Username, cfg.Password)
	req.Header.Set("X-Index", strconv.Itoa(c.hcb.Index))
	resp, err := c.cli.Do(req)
	if err != nil {
		return err
	}
	if resp.StatusCode != http.StatusOK {
		return nil
	}
	xIndex, _ := strconv.Atoi(resp.Header.Get("X-Index"))
	if xIndex == 0 {
		return nil
	}
	xType := resp.Header.Get("X-Type")
	if xType == "" {
		return nil
	}
	xFileName := resp.Header.Get("X-FileName")
	if xType == gcopy.TypeFile && xFileName == "" {
		return nil
	}
	if xFileName != "" {
		xFileName, err = url.QueryUnescape(xFileName)
		if err != nil {
			return err
		}
	}
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if data == nil {
		return nil
	}
	if err := os.WriteFile(DataFilePath, data, 0755); err != nil {
		return err
	}
	c.hcb = &host.HostClipboard{
		Clipboard: &gcopy.Clipboard{
			Index:    xIndex,
			Type:     xType,
			FileName: xFileName,
			Data:     data,
		},
		FilePath: DataFilePath,
	}
	c.log.Infof("pulled %s(%v)", c.hcb.Type, c.hcb.Index)

	return c.mgr.Set(c.hcb)
}

func (c *Client) pushClipboard() error {
	cfg := config.Get()
	out := host.HostClipboard{
		Clipboard: &gcopy.Clipboard{},
		FilePath:  DataFilePath,
	}
	if err := c.mgr.Get(&out); err != nil {
		return err
	}
	if c.hcb.Hash == "" {
		c.hcb.Hash = out.Hash
		return nil
	}
	if out.Hash == c.hcb.Hash || file.Empty(out.FilePath) {
		return nil
	}

	fileInfo, err := os.Stat(out.FilePath)
	if err != nil {
		return err
	}
	if size := fileInfo.Size(); size > 100*1024*1024 {
		return fmt.Errorf("file being pushed too large: %vMi > 100Mi", size/1024/1024)
	}

	data, err := os.ReadFile(out.FilePath)
	if err != nil {
		return err
	}
	out.Data = data

	req, err := http.NewRequest(http.MethodPost, config.Get().Server+"/clipboard", bytes.NewReader(out.Data))
	if err != nil {
		return err
	}
	req.SetBasicAuth(cfg.Username, cfg.Password)
	req.Header.Set("X-Type", out.Type)
	req.Header.Set("X-FileName", url.QueryEscape(out.FileName))
	resp, err := c.cli.Do(req)
	if err != nil {
		return err
	}
	if resp.StatusCode != http.StatusOK {
		return nil
	}
	xIndex, _ := strconv.Atoi(resp.Header.Get("X-Index"))
	if xIndex == 0 {
		return nil
	}
	out.Index = xIndex
	c.hcb = &out
	c.log.Infof("pushed %s(%v)", c.hcb.Type, c.hcb.Index)

	return nil
}
