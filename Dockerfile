FROM node:24-bookworm-slim AS development
WORKDIR /app
ENV SCARF_ANALYTICS=false
COPY package.json package-lock.json .npmrc ./
RUN npm ci --no-audit --no-fund && chown -R node:node /app
COPY --chown=node:node . .
USER node
EXPOSE 4000
CMD ["npm", "run", "start:dev"]

FROM development AS build
RUN npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV SCARF_ANALYTICS=false
COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev --no-audit --no-fund && chown -R node:node /app
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 4000
CMD ["node", "dist/main.js"]
