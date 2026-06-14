# 使用 Docker 部署

GCopy 提供单一容器镜像，前端已嵌入 Go 二进制中。

## 快速开始

浏览器剪贴板 API 要求 HTTPS。以下示例使用自签名证书快速启动：

```bash
# 1. 生成自签名证书
curl -sSL https://raw.githubusercontent.com/llaoj/gcopy/main/scripts/gen-cert.sh | bash

# 2. 启动容器
docker run -d \
  --name gcopy \
  --restart unless-stopped \
  -p 3375:3375 \
  -v $(pwd)/cert.pem:/cert.pem:ro \
  -v $(pwd)/key.pem:/key.pem:ro \
  -e GCOPY_APP_KEY=your-secret-key-min-8-chars \
  -e GCOPY_AUTH_MODE=token \
  -e GCOPY_TLS_CERT_FILE=/cert.pem \
  -e GCOPY_TLS_KEY_FILE=/key.pem \
  llaoj/gcopy:latest
```

访问 `https://<host>:3375`，浏览器会提示证书不受信任，选择继续即可。

> 也可以使用正式证书或反向代理提供 HTTPS，参见下方 [TLS 配置](#tls内置-https)。

## 配置

所有配置通过 `GCOPY_` 前缀的环境变量完成。

### 令牌认证（推荐个人使用）

```yaml
-e GCOPY_APP_KEY=your-secret-key-min-8-chars
-e GCOPY_AUTH_MODE=token
```

无需 SMTP，用户使用 6 位字符令牌认证。

### 邮箱认证

```yaml
-e GCOPY_APP_KEY=your-secret-key-min-8-chars
-e GCOPY_AUTH_MODE=email
-e GCOPY_SMTP_HOST=smtp.example.com
-e GCOPY_SMTP_PORT=587
-e GCOPY_SMTP_USERNAME=your-email@example.com
-e GCOPY_SMTP_PASSWORD=your-smtp-password
```

### TLS（内置 HTTPS）

GCopy 可以直接加载证书提供 HTTPS 服务，无需反向代理：

```yaml
-e GCOPY_TLS_CERT_FILE=/path/to/cert.pem
-e GCOPY_TLS_KEY_FILE=/path/to/key.pem
# 将证书文件挂载到容器中
-v /path/to/cert.pem:/path/to/cert.pem:ro
-v /path/to/key.pem:/path/to/key.pem:ro
```

`GCOPY_TLS_CERT_FILE` 和 `GCOPY_TLS_KEY_FILE` 必须同时设置才能启用 TLS。

### 反向代理

GCopy 以 HTTP 启动，由反向代理（Nginx、Caddy 等）处理 TLS：

```yaml
-e GCOPY_LISTEN=127.0.0.1:3375
# 不需要配置 TLS 环境变量
```

反向代理将 HTTPS 流量转发到 3375 端口即可。

### 环境变量说明

| 变量 | 说明 | 默认值 | 必需 |
|------|------|--------|------|
| `GCOPY_APP_KEY` | 加密密钥（至少 8 个字符） | - | 是 |
| `GCOPY_AUTH_MODE` | `email` 或 `token` | `email` | 否 |
| `GCOPY_LISTEN` | 监听地址 | `:3375` | 否 |
| `GCOPY_TLS_CERT_FILE` | TLS 证书文件路径 | - | 否 |
| `GCOPY_TLS_KEY_FILE` | TLS 密钥文件路径 | - | 否 |
| `GCOPY_MAX_CONTENT_LENGTH` | 最大剪切板大小（MiB） | `10` | 否 |
| `GCOPY_DEBUG` | 调试模式 | `false` | 否 |
| `GCOPY_SMTP_HOST` | SMTP 服务器地址 | - | 邮箱模式 |
| `GCOPY_SMTP_PORT` | SMTP 端口 | `587` | 否 |
| `GCOPY_SMTP_USERNAME` | SMTP 用户名 | - | 邮箱模式 |
| `GCOPY_SMTP_PASSWORD` | SMTP 密码 | - | 邮箱模式 |
| `GCOPY_SMTP_SENDER` | 邮件发送者（默认同用户名） | - | 否 |
| `GCOPY_SMTP_SSL` | 使用 SSL | `false` | 否 |
