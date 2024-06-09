# 使用docker单机部署
我们已经为您准备好了容器镜像. 直接使用docker进行部署最方便. 

## 单机部署
借助docker-compose的容器编排能力, 我们部署gcopy的前后端服务.

### 创建`docker-compose.yaml`文件
创建目录, 并将 `deploy/docker-compose.yml`下载到该目录，修改`docker-compose.yml`的中命令参数`<var-name>`.

```bash
# 目录位置可以自定义
mkdir -p /opt/gcopy
wget -O /opt/gcopy/docker-compose.yml https://raw.githubusercontent.com/llaoj/gcopy/main/deploy/docker-compose.yml
```

命令参数的修改参考gcopy的使用方法:

```bash
$ /gcopy --help
gcopy 使用方法：
    -app-key string
        用于加密和解密数据的密钥，建议使用 8 个字符以上的随机字符串。
    -debug
        启用调试模式
    -listen string
        服务器将监听此 ip 和端口，格式：[ip]:port（默认“:3376”）
    -max-content-length int
        最大同步内容大小，单位：MiB。（默认 10）
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

### 创建前端配置文件
直接下载`frontend/.env.sample`示例配置文件, 目前不用修改.

```bash
mkdir -p /opt/gcopy/frontend
wget -O /opt/gcopy/frontend/.env.production https://raw.githubusercontent.com/llaoj/gcopy/main/frontend/.env.sample
```

### 启动容器

```sh
docker-compose up -d
```

## 反向代理
由于浏览器安全限制, 需要https才能正常使用, 我们推荐部署在反向代理的后面, 例如 Nginx, Apisix等. 所以, 你需要准备好域名和对应的证书.  
我们以nginx为例, 参考`deploy/nginx-example.conf`.

至此, 部署结束, 使用gcopy吧!