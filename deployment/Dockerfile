# Agent HQ Production Dockerfile
# Multi-stage build for optimal production image
FROM node:20-bullseye AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN npm ci && npm cache clean --force

# Build stage
FROM base AS builder
WORKDIR /app
COPY . .
COPY --from=deps /app/node_modules ./node_modules

# Build the application
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Install required OS dependencies and Playwright Chromium
RUN apt-get update && apt-get install -y \
    curl \
    libnss3 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libgtk-3-0 \
    fonts-liberation \
    fonts-noto-color-emoji \
  && rm -rf /var/lib/apt/lists/*

# Install Playwright with Chromium browser
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npm exec --yes playwright install --with-deps chromium

# Create non-root user for security and install curl for healthcheck
# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder --chown=nextjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nextjs:nodejs /app/server ./server
COPY --from=builder --chown=nextjs:nodejs /app/shared ./shared
COPY --from=builder --chown=nextjs:nodejs /app/worker ./worker
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --chown=nextjs:nodejs package.json ./

USER nextjs

EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:5000/api/health || exit 1

CMD ["npm", "start"]