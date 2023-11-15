both:
	go run cmd/gcopy.go --role=server,client --tls --certFile="/Users/weiyangwang/proj/gcopy/cert.pem" --keyFile="/Users/weiyangwang/proj/gcopy/key.pem" --server=https://gcopy.rutron.net:3375 --insecureSkipVerify --debug
server:
	go run cmd/gcopy.go --role=server --tls --certFile="/Users/weiyangwang/proj/gcopy/cert.pem" --keyFile="/Users/weiyangwang/proj/gcopy/key.pem"
client:
	go run cmd/gcopy.go --role=client --server=https://gcopy.rutron.net:3375 --insecureSkipVerify --debug 
release:
	goreleaser release --snapshot --clean