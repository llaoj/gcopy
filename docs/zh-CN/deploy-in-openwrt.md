# 在OpenWrt上源码部署GCopy

### 源码下载
```bash
git clone https://github.com/llaoj/gcopy.git
cd gcopy
```

### 后端部署
1. 编译后端
```bash
make ./bin/gcopy
```

2. 将后端文件存到bin路径
```bash
chmod +x ./bin/gcopy
sudo cp ./bin/gcopy /usr/bin/gcopy
```

3. 编写启动文件`deploy_backend.sh`，下面是一个qq邮箱的示范，可以自己去qq邮箱拿授权码。-apk-key后面对应的是一个自定义加密密钥，建议8位以上。
```bash
#!/bin/bash

/usr/bin/gcopy \
    -app-key="xxxxxxxx" \
    -smtp-host=smtp.qq.com \
    -smtp-port=465 \
    -smtp-username=xxxxx@qq.com \
    -smtp-password="xxxxxx" \
    -smtp-ssl
```

4. 编写服务，`/etc/init.d/gcopy_backend`，实例代码中`deploy_backend.sh`位于`/root/packages/deploy_backend.sh`，你可以写成你自己的路径。
```bash
#!/bin/sh /etc/rc.common

# You may need to adjust these
START=99
STOP=10

USE_PROCD=1
PROG=/root/packages/deploy_backend.sh
USER=root
GROUP=root
WORKING_DIRECTORY=/root/packages

start_service() {
    procd_open_instance
    procd_set_param command $PROG
    procd_set_param user $USER
    procd_set_param group $GROUP
    procd_set_param stdout 1
    procd_set_param stderr 1
    procd_set_param respawn
    procd_set_param dir $WORKING_DIRECTORY
    procd_close_instance
}

stop_service() {
    killall gcopy
}
```

5. 启动服务
```bash
service gcopy_backend start
```

6. 观察服务状态
```bash
service gcopy_backend info
```
- 输出如下，注意上面的`running`=`true`，说明没啥问题。
```json
{
        "gcopy_backend": {
                "instances": {
                        "instance1": {
                                "running": true,
                                "pid": 2376,
                                "command": [
                                        "/root/packages/deploy_backend.sh"
                                ],
                                "term_timeout": 5,
                                "respawn": {
                                        "threshold": 3600,
                                        "timeout": 5,
                                        "retry": 5
                                },
                                "user": "root",
                                "group": "root"
                        }
                }
        }
}
```
7. 设置开机自启动
```bash
service gcopy_backend enable
```


### 部署前端
1. 进入前端的文件夹
```bash
cd frontend
```

2. 复制一份配置文件出来
```bash
cp .env.sample .env
```

3. 修改.env,将里面的域名换成localhost，代表本地请求。
- 更改前
```bash
SERVER_URL=http://gcopy:3376
```
- 更改后
```bash
SERVER_URL=http://localhost:3376
```

4. 修改一下`package.json`，去除dev对应的`--experimental-https`
- 修改前
```bash
"dev": "next dev -p 3375 --experimental-https",
```
- 修改后
```bash
"dev": "next dev -p 3375"
```

5. 编译前端并进行测试，测试无误，用`Ctrl` + `C`停止服务。
```bash
npm install
npm run dev
```

6. 创建一个`deploy_backend.sh`，写入下面的内容。你可以将`/root/packages/gcopy/frontend`换成你的路径。
```bash
#!/bin/bash

cd /root/packages/gcopy/frontend
npm run dev
```

7. 编写service,路径放在`/etc/init.d/gcopy_front`，填入以下内容，注意路径换成你的。
```bash
#!/bin/sh /etc/rc.common

# You may need to adjust these
START=99
STOP=10

USE_PROCD=1
USER=root
GROUP=root
PROG=/root/packages/deploy_front.sh
WORKING_DIRECTORY=/root/packages/gcopy/frontend

start_service() {
    procd_open_instance
    procd_set_param command $PROG
    procd_set_param user $USER
    procd_set_param group $GROUP
    procd_set_param stdout 1
    procd_set_param stderr 1
    procd_set_param respawn
    procd_set_param dir $WORKING_DIRECTORY
    procd_close_instance
}

stop_service() {
    killall node
}
```
8. 和上面一样，启动服务
```bash
service gcopy_front start
```
9. 观察服务状态
```bash
service gcopy_front info
```

10. 设置开机自启动
```bash
service gcopy_front enable
```

### 部署nginx
1. gcopy需要https才能正常使用，所以这里需要我们准备好tls证书，域名，最好还有公网ip（如果没有，也可以直接在路由器里面设置主机映射，强制绑定局域网ip到某个域名下。）如果有ipv6的，可以将其解析到cloudflare以获得免费的CDN。
2. 编写nginx配置（此处省略nginx安装过程），路径在`/etc/nginx/conf.d/gcopy.http3.cc.conf`，这个conf文件名称可以任意，以你的域名为名就行。
3. 填入下面的内容，注意域名`gcopy.http3.cc`换成你的，证书路径也换成你的。
```bash
upstream upstream_gcopy_frontend {
    server localhost:3375 weight=1 max_fails=3 fail_timeout=30s;
}

upstream upstream_gcopy {
    server localhost:3376 weight=1 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;
    listen [::]:80;
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name  gcopy.http3.cc;
    if ($server_port !~ 443){
        rewrite ^(/.*)$ https://$host$1 permanent;
    }
    ssl_certificate    /etc/nginx_cert/http3.cc/http3.cc.pem;
    ssl_certificate_key    /etc/nginx_cert/http3.cc/http3.cc.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers on;
    ssl_session_timeout 10m;
	  
    proxy_connect_timeout 180;
    proxy_send_timeout 180;
    proxy_read_timeout 180;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    location / {
        proxy_pass http://upstream_gcopy_frontend;
    }

    location /api/v1 {
        proxy_pass http://upstream_gcopy;
    }
}
```

4. 检查nginx配置是否正确。
```bash
nginx -t
```

5. 重载或者重启nginx服务
```bash
service nginx reload
# 或者
service nginx restart
```

6. 然后打开你刚刚的网站测试一下吧。
