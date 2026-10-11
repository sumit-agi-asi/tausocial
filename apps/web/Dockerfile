FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json

RUN npm ci --workspace @tausocial/web --include-workspace-root

COPY apps/web apps/web

RUN npm run build -w @tausocial/web

FROM nginxinc/nginx-unprivileged:stable-alpine AS runtime
USER root
RUN apk add --no-cache gettext

COPY apps/web/nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

ENV API_UPSTREAM=http://api:4000
EXPOSE 8080
USER 101
