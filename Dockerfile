# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig*.json nest-cli.json ./
COPY src ./src

RUN npm run build

# ── Stage 2: production ────────────────────────────────────────────────────────
FROM node:22-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
# Migration SQL files must be present at runtime so dist/db/migrate.js can apply them
COPY drizzle ./drizzle

EXPOSE 3000

# Run pending migrations before starting the server
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/main"]
