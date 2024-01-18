FROM golang

WORKDIR /app
COPY . .

RUN go mod download
RUN go mod verify

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /gcopy ./cmd

From alpine

WORKDIR /
COPY --from=0 /gcopy .

EXPOSE 3375

ENTRYPOINT ["/gcopy"]