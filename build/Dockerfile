From alpine
WORKDIR /app/
COPY gcopy .
COPY internal/server/templates/index.tmpl internal/server/templates/index.tmpl
ENTRYPOINT ["./gcopy", "--role=server"]