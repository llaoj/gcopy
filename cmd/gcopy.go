package main

import (
	"fmt"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/llaoj/gcopy/internal/client"
	"github.com/llaoj/gcopy/internal/config"
	"github.com/llaoj/gcopy/internal/server"
	"github.com/sirupsen/logrus"
)

func main() {
	fmt.Println(`
  __ _  ___ ___  _ __  _   _ 
 / _  |/ __/ _ \| '_ \| | | |
| (_| | (_| (_) | |_) | |_| |
 \__, |\___\___/| .__/ \__, |
  __/ |         | |     __/ |
 |___/          |_|    |___/ `)
	fmt.Println()

	cfg := config.Get()
	log := logrus.New()
	log.SetOutput(os.Stdout)
	if cfg.Debug {
		log.SetLevel(logrus.TraceLevel)
	} else {
		log.SetLevel(logrus.InfoLevel)
	}
	log.Debugf("config: %+v", cfg)

	var wg sync.WaitGroup
	if strings.Contains(cfg.Role, "server") {
		srv, err := server.NewServer(log)
		if err != nil {
			log.Fatal(err)
		}
		wg.Add(1)
		go srv.Run(&wg)
		time.Sleep(time.Second)
	}

	if strings.Contains(cfg.Role, "client") {
		cli, err := client.NewClient(log)
		if err != nil {
			log.Fatal(err)
		}
		wg.Add(1)
		go cli.Run(&wg)
	}

	wg.Wait()
}
