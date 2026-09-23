ARG ALPINE_VERSION=3.24


# ============================================================
# Dependencies
# ============================================================

FROM node:22-alpine${ALPINE_VERSION} AS deps

WORKDIR /app

COPY package*.json ./

RUN npm ci


# ============================================================
# Build
# ============================================================

FROM node:22-alpine${ALPINE_VERSION} AS build

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./
COPY src ./src

RUN npm run build


# ============================================================
# Production dependencies
# ============================================================

FROM node:22-alpine${ALPINE_VERSION} AS prod-deps

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev


# ============================================================
# Runtime
# ============================================================

FROM alpine:${ALPINE_VERSION} AS runtime

WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache libstdc++ \
  && addgroup -S nodeapp \
  && adduser -S nodeapp -G nodeapp \
  && mkdir -p /app/public /app/tmp /app/data/geoip \
  && chown -R nodeapp:nodeapp /app/public /app/tmp /app/data

COPY --from=prod-deps /usr/local/bin/node /usr/local/bin/node
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package*.json ./

USER nodeapp

EXPOSE 4000

CMD ["node", "dist/main.js"]