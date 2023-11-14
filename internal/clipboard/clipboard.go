package clipboard

type Clipboard struct {
	Index       int
	ContentType string
	ContentHash string
	// The clipboard contents are written to this file,
	// required when creating
	ContentFilePath string
	// Clipboard file content,
	// not required
	ContentFileData []byte
	// When copied content is file
	// The real filename will be recorded
	CopiedFileName string
}
