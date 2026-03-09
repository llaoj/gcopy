# Arch Linux 从 AUR 安装

由 [@devome](https://github.com/devome) 维护的 AUR 包使用稳定版 GCopy 来进行构建。

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

## 安装

由于GCopy前端和后端可以分离安装，所以 AUR 包将其分为了两个包：后端 [gcopy](https://aur.archlinux.org/packages/gcopy)，前端 [gcopy-web](https://aur.archlinux.org/packages/gcopy-web)。你可以在不同的主机上安装他们，也可以在同一个主机上安装它们。

```shell
## 安装后端，你也可以更换成yay来安装
paru -Sy gcopy

## 安装前端，你也可以更换成yay来安装
paru -Sy gcopy-web
```

## 配置

### 后端

对于后端，配置文件为 `/etc/gcopy/gcopy.env`，按照其注释编辑即可。

#### 邮箱认证模式

```shell
APPEND_ARGS="-auth-mode=email -app-key='rqMrHprILwYintES4UeQc0wM/252SLy59y7LMYKXJE0=' -max-content-length=10 -smtp-host='smtp.example.com' -smtp-port='587' -smtp-username='username@example.com' -smtp-password='your_password' -smtp-ssl"
```

#### 令牌认证模式

```shell
APPEND_ARGS="-auth-mode=token -app-key='rqMrHprILwYintES4UeQc0wM/252SLy59y7LMYKXJE0=' -max-content-length=10"
```

**注意：** 令牌模式无需 SMTP 配置，适合以下场景：
- 内网/局域网环境
- 个人使用
- 可信团队环境

对于`app-key`，你可以使用以下命令来生成一个随机字符串：

```shell
openssl rand -base64 32
```

### 前端

对于前端，配置文件为 `/etc/gcopy/gcopy-web.env`，按照其注释编辑即可，如果后端和前端在不同主机上，请注意修改`SERVER_URL`。

## 启动

配置好以后，启动即可：

```shell
## 启动后端
sudo systemctl enable --now gcopy.service

## 启动前端
sudo systemctl enable --now gcopy-web.service
```

## 反向代理

在生产模式, 推荐部署在反向代理的后面, 例如 Nginx、Apisix等. 这样您就可以方便的管理证书和配置代理, 你需要准备好域名和对应的证书。以nginx为例, 参考`/usr/share/gcopy-web/nginx-example.conf`。
