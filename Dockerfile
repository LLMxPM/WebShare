# 文件功能描述：构建管理前端并打包 Go 单体应用的容器镜像。
FROM node:22-alpine AS web-builder
WORKDIR /src
ARG PNPM_VERSION=10.30.3
COPY web/package.json web/pnpm-lock.yaml ./web/
RUN npm install --global pnpm@${PNPM_VERSION} && pnpm --dir web install --frozen-lockfile
COPY web ./web
RUN pnpm --dir web build

FROM golang:1.25-alpine AS go-builder
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
COPY --from=web-builder /src/web/dist ./web/dist
RUN CGO_ENABLED=0 go build -o /out/webshare ./cmd/webshare
RUN CGO_ENABLED=0 GOOS=windows GOARCH=amd64 go build -ldflags="-H windowsgui" -o /out/webshare-runner-windows-amd64.exe ./cmd/webshare-runner

FROM alpine:3.22
WORKDIR /app
COPY --from=go-builder /out/webshare /app/webshare
COPY --from=go-builder /out/webshare-runner-windows-amd64.exe /app/release/webshare-runner-windows-amd64.exe
VOLUME ["/data"]
EXPOSE 8080 8081 12000-12999
ENV DATA_DIR=/data
ENV ADMIN_ADDR=:8080
ENV SHARE_ADDR=:8081
ENV PUBLIC_HOST=localhost
ENV LOG_STDOUT=true
ENV LOG_FILE=/data/logs/webshare.log
ENTRYPOINT ["/app/webshare"]
