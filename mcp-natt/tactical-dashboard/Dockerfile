FROM node:20-alpine

WORKDIR /app

# Copy NATT MCP server
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Copy dashboard
COPY tactical-dashboard/package.json ./tactical-dashboard/
WORKDIR /app/tactical-dashboard
RUN npm ci --omit=dev

COPY tactical-dashboard ./

WORKDIR /app/tactical-dashboard

# Create memory dir
RUN mkdir -p /data/.natt-memory

ENV PORT=7474
ENV NODE_ENV=production

EXPOSE 7474

CMD ["node", "server.js"]
