package version

import "fmt"

var version string = "UNKNOWN"

func Version() string {
	return version
}

func PrintVersion() {
	fmt.Println(version)
}
