package gzip

import (
	"compress/gzip"
	"io"
	"os"
)

func CompressFile(src, dst string) error {
	// Open the original file
	originalFile, err := os.Open(src)
	if err != nil {
		return err
	}
	defer originalFile.Close()

	// Create a new gzipped file
	gzippedFile, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer gzippedFile.Close()

	gzipWriter := gzip.NewWriter(gzippedFile)
	defer gzipWriter.Close()

	// Copy the contents of the original file to the gzip writer
	_, err = io.Copy(gzipWriter, originalFile)
	if err != nil {
		return err
	}

	// Flush the gzip writer to ensure all data is written
	return gzipWriter.Flush()
}

func DecompressFile(src, dst string) error {
	// Open the gzipped file
	gzippedFile, err := os.Open(src)
	if err != nil {
		return err
	}
	defer gzippedFile.Close()

	// Create a new gzip reader
	gzipReader, err := gzip.NewReader(gzippedFile)
	if err != nil {
		return err
	}
	defer gzipReader.Close()
	// Create a new file to hold the uncompressed data
	uncompressedFile, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer uncompressedFile.Close()

	// Copy the contents of the gzip reader to the new file
	_, err = io.Copy(uncompressedFile, gzipReader)
	return err
}
