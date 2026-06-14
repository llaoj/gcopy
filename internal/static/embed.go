package static

import (
	"embed"
	"io/fs"
)

//go:embed all:dist
var embeddedFiles embed.FS

func AssetFS() fs.FS {
	sub, _ := fs.Sub(embeddedFiles, "dist")
	return sub
}
