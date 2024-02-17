package utils

import "testing"

func TestStrMaskMiddle(t *testing.T) {
	str := StrMaskMiddle("qustwwy@163.com")
	if str != "qust*******.com" {
		t.Error(str)
	}
	str = StrMaskMiddle("h@qq.com")
	if str != "h@qq.com" {
		t.Error(str)
	}
	str = StrMaskMiddle("h@qq.cc")
	if str != "h@qq.cc" {
		t.Error(str)
	}
}
