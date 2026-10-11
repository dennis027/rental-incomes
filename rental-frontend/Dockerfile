# ---- Build stage ----
FROM node:22-alpine AS build

WORKDIR /app

# Install dependencies first so this layer is cached until the lockfile changes
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# The API URL is compiled into the bundle and is called from the user's browser,
# so it must be reachable from the host machine (not a compose service name).
# src/environments is gitignored, so generate it here.
ARG API_URL=http://localhost:8000/
RUN mkdir -p src/environments \
    && echo "export const environment = { production: false, apiUrl: '${API_URL}' };" > src/environments/environment.ts \
    && echo "export const environment = { production: true, apiUrl: '${API_URL}' };" > src/environments/environment.prod.ts

# src/index.html carries the GitHub Pages base href; the container serves from /
RUN npm run build -- --base-href /

# ---- Runtime stage ----
FROM node:22-alpine

ENV NODE_ENV=production \
    PORT=4000

WORKDIR /app

# The SSR server bundle is self-contained, so only dist is needed at runtime
COPY --from=build --chown=node:node /app/dist/rental-frontend ./dist/rental-frontend
USER node

EXPOSE 4000

CMD ["node", "dist/rental-frontend/server/server.mjs"]
