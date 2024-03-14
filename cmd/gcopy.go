package main

import (
	"fmt"
	"os"

	"github.com/llaoj/gcopy/internal/config"
	"github.com/llaoj/gcopy/internal/server"
	"github.com/sirupsen/logrus"
)

func main() {
	cfg := config.Get()
	if cfg == nil {
		return
	}

	fmt.Println(`
  __ _  ___ ___  _ __  _   _ 
 / _  |/ __/ _ \| '_ \| | | |
| (_| | (_| (_) | |_) | |_| |
 \__, |\___\___/| .__/ \__, |
  __/ |         | |     __/ |
 |___/          |_|    |___/ `)
	fmt.Println()

	log := logrus.New()
	log.SetOutput(os.Stdout)
	if cfg.Debug {
		log.SetReportCaller(true)
		log.SetLevel(logrus.TraceLevel)
	} else {
		log.SetLevel(logrus.InfoLevel)
	}
	log.Debugf("config: %+v", cfg)
	server.NewServer(log).Run()
}
