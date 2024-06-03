# Deployment GCopy in OpenWrt with source code

### Source code download
```bash
git clone https://github.com/llaoj/gcopy.git
cd gcopy
```

### Backend deployment
1. Compile the backend
```bash
make ./bin/gcopy
```

2. Save the backend file to the bin path
```bash
chmod +x ./bin/gcopy
sudo cp ./bin/gcopy /usr/bin/gcopy
```

3. Write the startup file `deploy_backend.sh`. The following is a demonstration of a QQ mailbox. You can go to the QQ mailbox to get the authorization code. -apk-key corresponds to a custom encryption key, which is recommended to be more than 8 digits.
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

4. Write the service, `/etc/init.d/gcopy_backend`, in the example code, `deploy_backend.sh` is located in `/root/packages/deploy_backend.sh`, you can write your own path.
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

5. Start the service
```bash
service gcopy_backend start
```
6. Observe the service status
```bash
service gcopy_backend info
```
- The output is as follows. Note that `running`=`true` above means there is no problem.
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
7. Set the boot to start automatically
```bash
service gcopy_backend enable
```



### Deploy the front-end
1. Enter the front-end folder
```bash
cd frontend
```

2. Copy a configuration file
```bash
cp .env.sample .env
```

3. Modify .env and replace the domain name with localhost, which represents local requests.
- Before change
```bash
SERVER_URL=http://gcopy:3376
```
- After change
```bash
SERVER_URL=http://localhost:3376
```

4. Modify `package.json` and remove `--experimental-https` corresponding to dev
- Before change
```bash
"dev": "next dev -p 3375 --experimental-https",
```
- After change
```bash
"dev": "next dev -p 3375"
```

5. Compile the front end and test it. If the test is correct, stop the service with `Ctrl` + `C`.
```bash
npm install
npm run dev
```

6. Create a `deploy_backend.sh` and write the following content. You can replace `/root/packages/gcopy/frontend` with your path.
```bash
#!/bin/bash

cd /root/packages/gcopy/frontend
npm run dev
```

7. Write the service, put the path in `/etc/init.d/gcopy_front`, fill in the following content, and pay attention to change the path to yours.
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
8. Same as above, start the service
```bash
service gcopy_front start
```
9. Observe the service status
```bash
service gcopy_front info
```

10. Set the system to start automatically
```bash
service gcopy_front enable
```

### Deploy nginx
1. gcopy requires https to work properly, so here we need to prepare tls certificates, domain names, and preferably public IP (if not, you can also directly set up host mapping in the router to force the binding of the LAN IP to a certain domain name.) If you have IPv6, you can resolve it to cloudflare to get free CDN.
2. Write nginx configuration (the nginx installation process is omitted here), the path is `/etc/nginx/conf.d/gcopy.http3.cc.conf`, the name of this conf file can be arbitrary, just use your domain name.
3. Fill in the following content, pay attention to the domain name `gcopy.http3.cc` replaced with yours, and the certificate path is also replaced with yours.
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

4. Check if nginx configuration is correct.
```bash
nginx -t
```

5. Reload or restart nginx service
```bash
service nginx reload
# or
service nginx restart
```

6. Then open the website you just created and test it.
