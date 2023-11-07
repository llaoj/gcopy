package clipboard

type Clipboard struct {
	Index       int
	ContentType string
	ContentHash string
	// clipboard content will ben writen in this file
	// Required when creating
	ContentFilePath string
	// When copied content is file
	// The real filename will be recorded
	CopiedFileName string
}
