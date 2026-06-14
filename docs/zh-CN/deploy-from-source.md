# 使用源代码部署

GCopy 是一个内嵌前端的单一 Go 二进制文件，无需单独部署前端。

## 获取二进制文件

### 从源码构建

前置条件：Go 1.20+、Node.js 18.17+、git

```bash
git clone https://github.com/llaoj/gcopy.git
cd gcopy
make bin/gcopy
```

构建过程：编译 Next.js 前端为静态文件 → 通过 `go:embed` 嵌入 Go 二进制 → 生成 `bin/gcopy`

### 从 Release 下载

从 [GitHub Releases](https://github.com/llaoj/gcopy/releases) 下载对应平台的二进制文件。

## 快速开始

浏览器剪贴板 API 要求 HTTPS。以下示例使用自签名证书快速启动：

```bash
# 1. 生成自签名证书
curl -sSL https://raw.githubusercontent.com/llaoj/gcopy/main/scripts/gen-cert.sh | bash

# 2. 启动
./gcopy -app-key=<your-key> -auth-mode=token -tls-cert-file=cert.pem -tls-key-file=key.pem
```

访问 `https://<host>:3375`，浏览器会提示证书不受信任，选择继续即可。

> 也可以使用正式证书或反向代理提供 HTTPS，参见下方 [HTTPS 配置](#https-配置)。

## 认证模式

所有配置可通过命令行参数或环境变量（`GCOPY_` 前缀）完成。

### 令牌认证（推荐个人使用）

```bash
...
-app-key=<your-key> \
-auth-mode=token
```

无需 SMTP，用户使用 6 位字符令牌认证。

### 邮箱认证

```bash
...
-app-key=<your-key> \
-auth-mode=email \
-smtp-host=<smtp-host> \
-smtp-username=<smtp-username> \
-smtp-password=<smtp-password>
```

## HTTPS 配置

浏览器剪贴板 API 要求 HTTPS，必须配置 HTTPS 才能正常使用。

### 使用自签名证书（快速测试）

```bash
curl -sSL https://raw.githubusercontent.com/llaoj/gcopy/main/scripts/gen-cert.sh | bash
```

使用该脚本生成本地自签名证书，浏览器会提示证书不受信任，选择继续即可。

或者，生产环境推荐为域名申请正式证书，然后：

### 配置域名证书

```bash
...
-tls-cert-file=/path/to/cert.pem \
-tls-key-file=/path/to/key.pem
```

配置证书后 GCopy 可直接提供 HTTPS 服务，无需反向代理。

### 使用反向代理

GCopy 以 HTTP 启动，由反向代理（Nginx、Caddy 等）处理 TLS：

```bash
...
-listen=127.0.0.1:3375
```

反向代理将 HTTPS 流量转发到 3375 端口即可。

## 配置参考

| 参数 | 环境变量 | 默认值 | 说明 |
|------|---------|--------|------|
| `-app-key` | `GCOPY_APP_KEY` | - | 加密密钥（至少 8 个字符，必需） |
| `-auth-mode` | `GCOPY_AUTH_MODE` | `email` | `email` 或 `token` |
| `-listen` | `GCOPY_LISTEN` | `:3375` | 监听地址 |
| `-tls-cert-file` | `GCOPY_TLS_CERT_FILE` | - | TLS 证书文件 |
| `-tls-key-file` | `GCOPY_TLS_KEY_FILE` | - | TLS 密钥文件 |
| `-max-content-length` | `GCOPY_MAX_CONTENT_LENGTH` | `10` | 最大剪切板大小（MiB） |
| `-debug` | `GCOPY_DEBUG` | `false` | 调试模式 |
| `-smtp-host` | `GCOPY_SMTP_HOST` | - | SMTP 地址（邮箱模式） |
| `-smtp-port` | `GCOPY_SMTP_PORT` | `587` | SMTP 端口 |
| `-smtp-username` | `GCOPY_SMTP_USERNAME` | - | SMTP 用户名（邮箱模式） |
| `-smtp-password` | `GCOPY_SMTP_PASSWORD` | - | SMTP 密码（邮箱模式） |
| `-smtp-sender` | `GCOPY_SMTP_SENDER` | - | 邮件发送者（默认同用户名） |
| `-smtp-ssl` | `GCOPY_SMTP_SSL` | `false` | 使用 SSL |
| `-version` | - | `false` | 打印版本 |

## 开发环境

使用 `scripts/dev.sh` 启动开发环境，前后端作为独立进程运行并支持热更新：

```bash
./scripts/dev.sh
```

- 前端：`https://localhost:3375`（Next.js 开发服务器，HTTPS）
- 后端：`https://localhost:3376`（Go 服务器，TLS）
