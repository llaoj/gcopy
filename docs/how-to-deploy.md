# How to deploy

## Docker compose

```sh
sed -i "s#^IRON_SESSION_PASSWORD=.*#IRON_SESSION_PASSWORD=$(openssl rand -base64 32)#" frontend/.env.production
docker-compose up -d
```

## Kubernetes

...