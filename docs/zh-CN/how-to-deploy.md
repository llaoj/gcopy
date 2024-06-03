# 如何部署

## 代理部署

需要 HTTPS，建议部署在代理后面，例如 Nginx、Ingress Controller

可以参考 Nginx 配置文件：`deploy/nginx-example.conf`

## Standalone

使用 docker compose:

1. 将 `deploy/docker-compose.yml` 复制到项目根目录，参考gcopy命令参数，修改 `docker-compose.yml` 的参数 `<var-name>`。

- 复制

    ```bash
    cp deploy/docker-compose.yml .
    ```

- gcopy-server 命令使用方法如下：

    ```bash
    ./bin/gcopy --help
        gcopy 使用方法：
        -app-key string
        	用于加密和解密数据的密钥，建议使用 8 个字符以上的随机字符串。
        -debug
        	启用调试模式
        -listen string
        	服务器将监听此 ip 和端口，格式：[ip]:port（默认“:3376”）
        -max-content-length int
        	最大同步内容长度，单位：MiB。（默认 10）
        -smtp-host string
        	表示 SMTP 服务器的主机。
        -smtp-password string
        	用于向 SMTP 服务器进行身份验证的密码。
        -smtp-port int
        	表示 SMTP 服务器的端口。（默认 587）
        -smtp-sender string
        	电子邮件的发件人，如果未提供该字段，则将使用用户名。
        -smtp-ssl bool
        	是否使用 SSL 连接。在大多数情况下，它应该是 false，因为身份验证机制应该使用 STARTTLS 扩展。
        -smtp-username string
        	用于向 SMTP 服务器进行身份验证的用户名。
        -tls
        	启用 TLS
        -tls-cert-file string
        	服务器的证书，如果启用 tls，则需要。
        -tls-key-file string
        	服务器的私钥，如果启用 tls，则需要。
        -version
        	打印版本
    ```

2. 创建前端的配置文件，请参阅：`frontend/.env.sample`，目前基本不用做改变。
```bash
cp frontend/.env.sample frontend/.env.production
```
3. 启动容器：

```sh
docker-compose up -d
```

## Kubernetes

您可以参考独立配置并将 GCopy 部署到 Kubernetes 中。
