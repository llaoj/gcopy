# Deploy from source code
If you want to start from the source code, deploy a development environment, or contribute code to gcopy, this document is suitable for you.

## Prerequisites
The following software needs to be installed on the server in advance:

- git
- golang 1.20+
- Node.js 18.17+

## Clone the source code
We clone the code to `/opt/gcopy/`. This directory location is not mandatory, you can customize it according to your needs.

```bash
cd /opt
git clone https://github.com/llaoj/gcopy.git
cd gcopy
```

## Backend
The backend primarily responsible for temporary storage of clipboard data and authentication. It does not store user data long-term, instead, it temporarily stores the latest clipboard data in memory, which expires after a period of time.

### Direct run
You can quickly start the local server using the `go run` command. The backend service is configured via command-line arguments. You need to manually replace `<var-name>`. The `-app-key` parameter in the configuration is a custom encryption key used for data encryption, recommended to be at least 8 characters long. Parameters starting with `-smtp-*` are all related to email service because gcopy relies on email login. Common email service providers offer SMTP services, such as Gmail, QQ Mail etc.

```bash
go run cmd/gcopy.go \
    -app-key=<app-key> \
    -smtp-host=<smtp-host> \
    -smtp-port=<smtp-port> \
    -smtp-username=<smtp-username> \
    -smtp-password=<smtp-password> \
    -smtp-ssl \
    -debug
```

### Build and run
You can also build before running. This way, you don't need to build before each run.

```shell
make ./bin/gcopy
chmod +x ./bin/gcopy
/opt/gcopy/bin/gcopy \
    -app-key=<app-key> \
    -smtp-host=<smtp-host> \
    -smtp-port=<smtp-port> \
    -smtp-username=<smtp-username> \
    -smtp-password=<smtp-password> \
    -smtp-ssl
```

## Frontend
The frontend primarily handles user interaction and is implemented based on the browser. It relies on the backend service to temporarily store user clipboard data, thereby achieving the goal of cross-device sharing.

### Configuration file
The frontend service is configured using a configuration file, mainly declaring information such as the backend service's address. Different environment configurations are stored in files with different `.env` file extensions.

```bash
cd /opt/gcopy/frontend
# development environment
cp .env.sample .env.local
# production environment
cp .env.sample .env.production
```

Modify the configuration file to change the backend service's address `SERVER_URL`. Since we are deploying locally, change the host to `localhost`.

```ini
- SERVER_URL=http://gcopy:3376
+ SERVER_URL=http://localhost:3376
```

### Run
The configuration files for the development environment and the production environment are different, as are the startup commands.

#### Development environment
Use the following command to start the development mode. It supports hot code reloading, error reporting, etc., and it listens on port 3375 by default.

```bash
cd /opt/gcopy/frontend
npm ci
npm run dev
```

Due to browser restrictions on using HTTPS, we'll use `--experimental-https` to enable HTTPS for the web server, using a self-signed certificate. 
Now, you can access gcopy using `https://<hostip-or-localhost>:3375`, and you don't need to add a proxy in front of it.

#### Production environment
Unlike development mode, the production mode is a mini web server that only includes essential files. Before starting it, you need to compile it with `npm run build`.

```bash
cd /opt/gcopy/frontend
npm ci
npm run build
# Copy the .next/static folders or be handled by a CDN instead
cp -r .next/static .next/standalone/.next/
NODE_ENV=production PORT=3375 node .next/standalone/server.js
```

In production mode, we recommend deploying behind a reverse proxy such as Nginx or Kong. This way, you can easily manage certificates and configure proxies. You'll need to prepare a domain name and its corresponding certificate for this setup.  
We'll use Nginx as an example, referring to `deploy/nginx-example.conf`.