package hash

import "testing"

func TestHashFile(t *testing.T) {
	hash, err := HashFile("../../../README.md")
	if err != nil {
		t.Error(err)
		return
	}
	t.Log(hash)
}
