FROM golang AS builder

ARG TARGETARCH

WORKDIR /app
COPY . .

RUN GOARCH=${TARGETARCH} make bin/gcopy

FROM alpine
LABEL maintainer="llaoj <hmmmbiubiubiu@gmail.com>"

WORKDIR /
COPY --from=builder /app/bin/gcopy .

EXPOSE 3376

ENTRYPOINT ["/gcopy"]
