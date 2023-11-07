package gzip

import "testing"

func TestCompress(t *testing.T) {
	err := CompressFile("/Users/weiyangwang/proj/gcopy-v2/README.md", "/Users/weiyangwang/proj/gcopy-v2/README.md.gz")
	if err != nil {
		t.Error(err)
	}

	err = DecompressFile("/Users/weiyangwang/proj/gcopy-v2/README.md.gz", "/Users/weiyangwang/proj/gcopy-v2/README-2.md")
	if err != nil {
		t.Error(err)
	}
}
