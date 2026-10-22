FROM node:24-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

FROM base AS development
WORKDIR /app
ENV SCARF_ANALYTICS=false
COPY package.json package-lock.json .npmrc ./
# postinstall genera Prisma y necesita el esquema durante npm ci.
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci --no-audit --no-fund && chown -R node:node /app
COPY --chown=node:node . .
USER node
EXPOSE 4000
CMD ["npm", "run", "start:dev"]

FROM development AS build
RUN npm run build

FROM build AS runtime-dependencies
# Conserva los binarios nativos instalados; no ejecuta postinstall sin Prisma CLI.
RUN npm prune --omit=dev --ignore-scripts --no-audit --no-fund

FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV SCARF_ANALYTICS=false
COPY --from=runtime-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/scripts/create-dev-admin.cjs ./scripts/create-dev-admin.cjs
USER node
EXPOSE 4000
CMD ["node", "dist/main.js"]
