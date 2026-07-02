# ── Template Vault image ───────────────────────────────
# Multi-stage build. better-sqlite3 is a native module, so we compile it in a
# builder stage (with toolchain) and copy the result into a slim runtime image.
FROM node:22-slim AS build
WORKDIR /app

# Build tools for compiling better-sqlite3 if no prebuilt binary is available.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ── Runtime ────────────────────────────────────────────
FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY public ./public

# Persisted data lives here (mount as volumes in production).
RUN mkdir -p data storage logs && chown -R node:node /app
USER node

EXPOSE 4000

# Liveness probe hits the public /api/auth endpoint (no auth needed).
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:4000/api/auth').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/index.js"]
