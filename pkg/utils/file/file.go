package file

import (
	"bytes"
	"fmt"
	"io"
	"os"
	"path/filepath"
)

func CopyFile(src, dst string) (int64, error) {
	sourceFileStat, err := os.Stat(src)
	if err != nil {
		return 0, err
	}

	if !sourceFileStat.Mode().IsRegular() {
		return 0, fmt.Errorf("%s is not a regular file", src)
	}

	source, err := os.Open(src)
	if err != nil {
		return 0, err
	}
	defer source.Close()

	err = os.MkdirAll(filepath.Dir(dst), os.ModePerm)
	if err != nil {
		return 0, err
	}

	destination, err := os.Create(dst)
	if err != nil {
		return 0, err
	}
	defer destination.Close()
	nBytes, err := io.Copy(destination, source)
	return nBytes, err
}

func IsDir(path string) bool {
	s, err := os.Stat(path)
	if err != nil {
		return false
	}
	return s.IsDir()
}

func Empty(path string) bool {
	out, err := os.ReadFile(path)
	if err != nil || len(out) == 0 {
		return true
	}
	out = bytes.TrimPrefix(out, []byte("\ufeff"))
	out = bytes.ReplaceAll(out, []byte("\r\n"), nil)
	out = bytes.ReplaceAll(out, []byte("\n"), nil)

	return len(out) == 0
}
