
# Install from AUR on Arch Linux

The AUR package maintained by [@devome](https://github.com/devome) uses the stable version of GCopy for building.

## Installation

Since the GCopy frontend and backend can be installed separately, the AUR package splits them into two packages: the backend [gcopy](https://aur.archlinux.org/packages/gcopy) and the frontend [gcopy-web](https://aur.archlinux.org/packages/gcopy-web). You can install them on different hosts, or you can install them on the same host.

```shell
## Install the backend, you can also use yay to install
paru -Sy gcopy

## Install the frontend, you can also use yay to install
paru -Sy gcopy-web
```

## Configuration

### Backend

For the backend, the configuration file is located at `/etc/gcopy/gcopy.env`. Edit it according to the comments, for example:

```shell
APPEND_ARGS="-app-key='rqMrHprILwYintES4UeQc0wM/252SLy59y7LMYKXJE0=' -smtp-host='smtp.example.com' -smtp-password='your_password' -smtp-username='username@example.com'"
```

For the `app-key`, you can generate a random string using the following command:

```shell
openssl rand -base64 32
```

### Frontend

For the frontend, the configuration file is located at `/etc/gcopy/gcopy-web.env`. Edit it according to the comments. If the backend and frontend are on different hosts, be sure to modify the `SERVER_URL`.

## Starting

After configuration, you can start the services:

```shell
## Start the backend
sudo systemctl enable --now gcopy.service

## Start the frontend
sudo systemctl enable --now gcopy-web.service
```

## Reverse Proxy

In production mode, it is recommended to deploy behind a reverse proxy, such as Nginx or Apisix. This makes it easier to manage certificates and configure the proxy. You will need to prepare a domain name and the corresponding certificate. For Nginx, refer to `/usr/share/gcopy-web/nginx-example.conf`.
