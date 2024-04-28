package gcopy

import "time"

type Clipboard struct {
	// The index of the clipboard
	Index int
	// The type of the clipboard, text screenshot & file
	Type string
	// The copied file name, required when the type is file
	FileName string
	// The chunk of data, less than 2^32(2GB).
	Data []byte
	// Create time of the data
	CreatedAt time.Time
	// The client where the clipboard data from, format: <os-name> <browser-name>
	ClientName string
}
