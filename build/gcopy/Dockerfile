FROM golang

WORKDIR /app
COPY . .

RUN go mod download
RUN go mod verify

RUN make output/linux_amd64/bin/gcopy

From alpine
LABEL maintainer="Llaoj <hmmmbiubiubiu@gmail.com>"

WORKDIR /
COPY --from=0 /app/output/linux_amd64/bin/gcopy .

EXPOSE 3376

ENTRYPOINT ["/gcopy"]