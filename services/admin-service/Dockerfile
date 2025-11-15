FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./

RUN npm ci --only=production && \
    npm install --save-dev typescript @types/node

COPY src ./src

RUN npm run build

FROM node:18-alpine

WORKDIR /app

RUN apk add --no-cache wget

COPY package*.json ./

RUN npm ci --only=production

COPY --from=builder /app/dist ./dist

RUN mkdir -p logs

ENV NODE_ENV=production

EXPOSE 3004

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3004/health || exit 1

CMD ["node", "dist/index.js"]
