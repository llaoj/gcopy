package static

import (
	"io/fs"
	"testing"
)

func TestAssetFS(t *testing.T) {
	assets := AssetFS()
	if assets == nil {
		t.Fatal("AssetFS() returned nil")
	}
	entries, err := fs.ReadDir(assets, ".")
	if err != nil {
		t.Fatalf("ReadDir(.) failed: %v", err)
	}
	if len(entries) == 0 {
		t.Fatal("expected embedded dist directory to contain at least .gitkeep")
	}
}
