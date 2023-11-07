both:
	go run cmd/gcopy.go --role=server,client --token=helloworld --debug
server:
	go run cmd/gcopy.go --role=server --token=helloworld --debug
client:
	go run cmd/gcopy.go --role=client --token=helloworld --debug
release:
	goreleaser release --snapshot --clean