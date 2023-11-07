package hash

import "testing"

func TestHashFile(t *testing.T) {
	hash, err := HashFile("/Users/weiyangwang/proj/gcopy-v2/README.md")
	if err != nil {
		t.Error(err)
		return
	}
	t.Log(hash)
}
