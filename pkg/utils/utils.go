package utils

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
