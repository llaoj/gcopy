# How to deploy

## Behind a proxy

HTTPS is required. I recommend deploying it behind a proxy, eg. Nginx, Ingress Controller

You can refer to the Nginx configuration file: `deploy/nginx-example.conf`

## Standalone

Using docker compose:

1. Create docker-compose.yml file, modify the params `<var-name>`, refer: `deploy/docker-compose.yml`. For the `<app-key>` param, use the following command:

```sh
sed -i "s#^<app-key>#$(openssl rand -base64 16)#" docker-compose.yml
```



2. Create configuration file of frontend, refer: `frontend/.env.sample`
3. Start the containers:

```sh

docker-compose up -d
```

## Kubernetes

You can refer to the configuration for a standalone and deploy GCopy into Kubernetes.