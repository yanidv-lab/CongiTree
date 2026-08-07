# ---- deps: install full deps (incl. vite/esbuild/typescript) needed to build ----
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ---- build: compile the client (vite build) and bundle the server (esbuild) ----
FROM oven/bun:1 AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

# ---- prod-deps: install only production dependencies (smaller, no dev tooling) ----
FROM oven/bun:1 AS prod-deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# ---- runtime: minimal image that just runs the built server bundle with Node ----
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Run as a non-root user rather than the container default root.
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs appuser

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

USER appuser

# Cloud Run (and most platforms) set PORT and route traffic to it; server.ts reads
# process.env.PORT with a fallback, so no default needs to be pinned here.
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server.cjs"]
