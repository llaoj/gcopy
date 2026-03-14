# 使用Docker单机部署
我们已经为您准备好了容器镜像. 直接使用Docker进行部署最方便.

## 认证模式

GCopy 支持两种认证模式：

### 邮箱认证（默认）
- 需要配置 SMTP 服务发送验证码
- 安全性更高
- 适合公网环境

### 令牌认证
- 无需 SMTP 配置，部署更简单
- 6 位字符令牌快速访问
- 会话有效期 7 天（滑动过期）
- 适合内网/局域网环境

详细配置和安全说明请参考 [TOKEN_AUTH.md](../TOKEN_AUTH.md)。

## 单机部署

GCopy 提供单一 Docker 镜像，包含前后端服务。镜像使用 supervisord 进行进程管理，只暴露一个端口（3375）。

### 创建`docker-compose.yml`文件

创建目录, 并将 `deploy/docker-compose.yml`下载到该目录：

```bash
# 目录位置可以自定义
mkdir -p /opt/gcopy
wget -O /opt/gcopy/docker-compose.yml https://raw.githubusercontent.com/llaoj/gcopy/main/deploy/docker-compose.yml
```

### 配置示例

GCopy 使用环境变量进行配置。所有环境变量使用 `GCOPY_` 前缀，避免与其他变量冲突。

#### 邮箱认证模式（默认）

编辑 `docker-compose.yml`：

```yaml
services:
  gcopy:
    environment:
      - GCOPY_APP_KEY=your-secret-key-min-8-chars
      - GCOPY_AUTH_MODE=email
      - GCOPY_MAX_CONTENT_LENGTH=10
      - GCOPY_SMTP_HOST=smtp.example.com
      - GCOPY_SMTP_PORT=587
      - GCOPY_SMTP_USERNAME=your-email@example.com
      - GCOPY_SMTP_PASSWORD=your-smtp-password
      - GCOPY_SMTP_SSL=false
```

#### 令牌认证模式

编辑 `docker-compose.yml`：

```yaml
services:
  gcopy:
    environment:
      - GCOPY_APP_KEY=your-secret-key-min-8-chars
      - GCOPY_AUTH_MODE=token
      - GCOPY_MAX_CONTENT_LENGTH=10
```

**注意：** 令牌模式无需 SMTP 配置，适合以下场景：
- 内网/局域网环境
- 个人使用
- 可信团队环境

### 环境变量说明

| 环境变量 | 说明 | 默认值 | 是否必需 |
|---------|------|--------|----------|
| `GCOPY_APP_KEY` | 加密密钥（至少8个字符） | - | ✅ 是 |
| `GCOPY_AUTH_MODE` | 认证模式：`email` 或 `token` | `email` | 否 |
| `GCOPY_LISTEN` | 后端监听地址 | `0.0.0.0:3376` | 否 |
| `GCOPY_MAX_CONTENT_LENGTH` | 最大剪切板大小（MiB） | `10` | 否 |
| `GCOPY_DEBUG` | 启用调试模式：`true` 或 `false` | `false` | 否 |
| `GCOPY_SMTP_HOST` | SMTP 服务器地址 | - | 是（邮箱模式） |
| `GCOPY_SMTP_PORT` | SMTP 服务器端口 | `587` | 否 |
| `GCOPY_SMTP_USERNAME` | SMTP 用户名 | - | 是（邮箱模式） |
| `GCOPY_SMTP_PASSWORD` | SMTP 密码 | - | 是（邮箱模式） |
| `GCOPY_SMTP_SENDER` | 邮件发送者地址 | (用户名) | 否 |
| `GCOPY_SMTP_SSL` | 使用 SSL 连接 | `false` | 否 |

### 启动容器

```sh
cd /opt/gcopy
docker-compose up -d
```

### 查看日志

容器将前后端日志都输出到 stdout/stderr，并带有前缀标识：

```sh
# 查看所有日志
docker logs gcopy

# 实时查看日志
docker logs -f gcopy
```

示例输出：
```
[backend] The server has started!
[frontend] ▲ Next.js 15.1.6
[frontend]   - Local:        http://localhost:3375
```

## 反向代理

由于浏览器安全限制, 需要 https 才能正常使用. 我们推荐部署在反向代理的后面, 例如 Nginx、Apisix 等. 所以, 你需要准备好域名和对应的证书.

我们以nginx为例, 参考 `deploy/nginx-example.conf`。配置只需代理到 3375 端口（前端端口），前端会在内部处理 API 路由。

### 重要说明

1. **单一端口**：容器只暴露 3375 端口。前后端在容器内部通信。
2. **无需 TLS 配置**：TLS 由反向代理处理，GCopy 后端不再处理 TLS。
3. **无需前端配置文件**：前端配置已构建到镜像中，不需要单独的 `.env.production` 文件。

至此, 部署结束, 使用gcopy吧!
