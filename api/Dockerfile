FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app/api
COPY api/package.json api/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund && npm cache clean --force
COPY api/src ./src
COPY api/openapi.yaml ./
COPY shared /app/shared
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:3000/salud || exit 1
CMD ["node", "src/server.js"]
