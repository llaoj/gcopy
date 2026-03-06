package utils

// StrMaskMiddle masks the middle characters of a string with '*'.
// Characters at index 4..len-5 (0-indexed) are replaced.
// Strings of 8 characters or fewer are returned unchanged.
func StrMaskMiddle(s string) string {
	rs := []rune(s)
	l := len(rs)
	for i := 0; i < l; i++ {
		if i > 3 && i < l-4 {
			rs[i] = '*'
		}
	}
	return string(rs)
}
