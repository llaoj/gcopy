# 使用源代码部署
如果你想要从源代码开始, 部署开发环境或者给gcopy贡献代码, 这篇文档适合你.

## 前置条件
下面这些软件是需要提前在服务器上安装好.

- git
- golang 1.20+
- Node.js 18.17+

## 源码下载
我们将代码clone到`/opt/gcopy/`. 该目录位置不是强制的, 你可以根据需要自定义.

```bash
cd /opt
git clone https://github.com/llaoj/gcopy.git
cd gcopy
```

## 认证模式

GCopy 支持两种认证模式：

### 邮箱认证（默认）
- 需要配置 SMTP 服务
- 发送 6 位验证码到邮箱
- 会话有效期 5 分钟
- 适合公网环境

### 令牌认证
- 无需 SMTP 配置
- 6 位字符令牌快速访问
- 会话有效期 7 天（滑动过期）
- 适合内网/局域网环境

详细配置和安全说明请参考 [TOKEN_AUTH.md](../TOKEN_AUTH.md)。

## 后端
后端是服务端, 主要负责剪切板数据的临时存储和身份认证. 它不会长期存储用户数据, 仅是在内存中临时存储用户最新剪切板数据, 一段时间后会数据就会过期.

### 直接启动
使用`go run`命令可以快速启动本地服务端. 后端服务是通过命令行参数来配置的.
你需要手动把`<var-name>`替换掉, 配置参数中的`-apk-key`参数是自定义加密密钥, 用于数据加密, 建议8位以上。

#### 邮箱认证模式

```bash
go run cmd/gcopy.go \
    -auth-mode=email \
    -app-key=<app-key> \
    -smtp-host=<smtp-host> \
    -smtp-port=<smtp-port> \
    -smtp-username=<smtp-username> \
    -smtp-password=<smtp-password> \
    -smtp-ssl \
    -debug
```

#### 令牌认证模式

```bash
go run cmd/gcopy.go \
    -auth-mode=token \
    -app-key=<app-key> \
    -debug
```

**注意：** 令牌模式无需 SMTP 配置，适合快速部署在内网/局域网等可信环境。

### 编译安装
当然, 你也可以选择先编译, 再运行它. 这样就不用在每次运行前执行编译了.

#### 邮箱认证模式

```shell
make ./bin/gcopy
chmod +x ./bin/gcopy
/opt/gcopy/bin/gcopy \
    -auth-mode=email \
    -app-key=<app-key> \
    -smtp-host=<smtp-host> \
    -smtp-port=<smtp-port> \
    -smtp-username=<smtp-username> \
    -smtp-password=<smtp-password> \
    -smtp-ssl
```

#### 令牌认证模式

```shell
make ./bin/gcopy
chmod +x ./bin/gcopy
/opt/gcopy/bin/gcopy \
    -auth-mode=token \
    -app-key=<app-key>
```

## 前端
前端主要负责用户交互的工作, 它基于浏览器实现. 它依赖后端服务将用户的剪切板数据临时存储, 从而达到跨设备共享的目的.

### 配置文件
前端服务使用配置文件进行配置, 配置文件主要声明了后端服务的地址等信息. 不同的环境`.env`文件的后缀不一样.

```bash
cd /opt/gcopy/frontend
# 开发环境
cp .env.sample .env.local
# 生产环境
cp .env.sample .env.production
```

修改配置文件, 修改后端服务的地址`SERVER_URL`, 因为我们是在本地部署, 将host修改成`localhost`, 代表本地请求.

```ini
- SERVER_URL=http://gcopy:3376
+ SERVER_URL=http://localhost:3376
```

### 启动
开发环境和生产环境的配置文件不同, 启动的命令也不一样.

#### 开发环境
使用下面的命令, 启动开发模式, 它可以代码热更新, 错误报告等. 默认监听3375端口.

```bash
cd /opt/gcopy/frontend
npm ci
npm run dev
```

由于浏览器限制, 我门必须要使用https, 通过`--experimental-https`为web服务器开启https, 使用自签证书.
好了, 下面就可以使用`https://<hostip-or-localhost>:3375`来访问gcopy了, 您无需在前面增加代理.

#### 生产环境
和开发模式不同, 生产模式是一个迷你Web服务器, 仅包含必要的文件, 启动之前需要先`npm run build`编译.

```bash
cd /opt/gcopy/frontend
npm ci
npm run build
# 复制.next/static文件夹 或者放在CDN上
cp -r .next/static .next/standalone/.next/
NODE_ENV=production PORT=3375 node .next/standalone/server.js
```

在生产模式, 我们推荐部署在反向代理的后面, 例如 Nginx、Apisix等. 这样您就可以方便的管理证书和配置代理, 你需要准备好域名和对应的证书.
我们以nginx为例, 参考`deploy/nginx-example.conf`.
