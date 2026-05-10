# ============================================================
# Dependencies
# ============================================================

FROM node:22-alpine AS deps

WORKDIR /app

COPY package*.json ./

RUN npm ci


# ============================================================
# Build
# ============================================================

FROM node:22-alpine AS build

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

FROM node:22-alpine AS prod-deps

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev


# ============================================================
# Runtime
# ============================================================

FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package*.json ./

RUN addgroup -S nodeapp \
  && adduser -S nodeapp -G nodeapp \
  && mkdir -p /app/public /app/tmp \
  && chown -R nodeapp:nodeapp /app/public /app/tmp

USER nodeapp

EXPOSE 4000

CMD ["node", "dist/main.js"]