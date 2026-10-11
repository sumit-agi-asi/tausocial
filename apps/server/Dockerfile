FROM node:25-alpine AS build
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json

RUN npm ci --workspace @tausocial/server --include-workspace-root

COPY apps/server/tsconfig.json apps/server/tsconfig.json
COPY apps/server/src apps/server/src

RUN npm run build --workspace @tausocial/server

FROM node:25-alpine AS prod-deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json

RUN npm ci --omit=dev --workspace @tausocial/server --include-workspace-root \
  && npm cache clean --force

FROM node:25-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=prod-deps --chown=node:node /app/package.json ./package.json
COPY --from=prod-deps --chown=node:node /app/apps/server/package.json ./apps/server/package.json
COPY --from=build --chown=node:node /app/apps/server/dist ./apps/server/dist

USER node
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/health/live >/dev/null || exit 1

CMD ["node", "apps/server/dist/index.js"]
