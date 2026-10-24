package log

import (
	"github.com/llaoj/gcopy/pkg/utils"
	"github.com/sirupsen/logrus"
)

// Logger wraps logrus and adds application-specific event logging.
type Logger struct {
	*logrus.Logger
	secret string
}

func New(base *logrus.Logger, secret string) *Logger {
	return &Logger{
		Logger: base,
		secret: secret,
	}
}

// Analytics records a pseudonymous usage event.
func (l *Logger) Analytics(event, subject string, fields logrus.Fields) {
	if l == nil || l.Logger == nil {
		return
	}
	if fields == nil {
		fields = logrus.Fields{}
	}
	fields["event"] = event
	fields["user"] = utils.HashID(l.secret, subject)
	l.WithFields(fields).Info("ANALYTICS")
}
