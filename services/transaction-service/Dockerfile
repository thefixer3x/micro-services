FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci || npm install

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:18-alpine

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Install curl for healthcheck
RUN apk add --no-cache curl

COPY --from=builder /app/package*.json ./
RUN npm ci --only=production 2>/dev/null || npm install --only=production && npm cache clean --force

COPY --from=builder /app/dist ./dist

USER nodejs

EXPOSE 3003

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl --fail http://localhost:3003/health || exit 1

CMD ["node", "dist/index.js"]
