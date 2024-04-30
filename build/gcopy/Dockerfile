FROM golang

WORKDIR /app
COPY . .

RUN GOARCH=${TARGETARCH} make bin/gcopy

FROM --platform=${TARGETPLATFORM} alpine
LABEL maintainer="llaoj <hmmmbiubiubiu@gmail.com>"

WORKDIR /
COPY --from=0 /app/bin/gcopy .

EXPOSE 3376

ENTRYPOINT ["/gcopy"]
