FROM node:22-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile

# Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN corepack enable pnpm && pnpm build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 devbot

COPY --from=builder --chown=devbot:nodejs /app/dist ./dist
COPY --from=builder --chown=devbot:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=devbot:nodejs /app/package.json ./package.json

USER devbot

EXPOSE 3100

CMD ["node", "dist/index.js"]
