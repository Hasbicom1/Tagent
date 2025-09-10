# Dockerfile for Playwright Browser Automation Worker
FROM node:18-bullseye-slim

# Install system dependencies required for Playwright
RUN apt-get update && apt-get install -y \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgcc1 \
    libgconf-2-4 \
    libgdk-pixbuf2.0-0 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install Node.js dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy worker source code
COPY worker/ ./worker/
COPY shared/ ./shared/

# Install TypeScript for compilation
RUN npm install -g typescript tsx

# Compile TypeScript
RUN tsc --project . --outDir ./dist

# Install Playwright browsers
RUN npx playwright install chromium firefox
RUN npx playwright install-deps

# Create user for running the worker (security best practice)
RUN groupadd -r worker && useradd -r -g worker -G audio,video worker \
    && mkdir -p /home/worker/Downloads \
    && chown -R worker:worker /home/worker \
    && chown -R worker:worker /app

# Set environment variables
ENV NODE_ENV=production
ENV WORKER_ID=worker-1
ENV BROWSER_TYPE=chromium
ENV MAX_CONCURRENT_BROWSERS=3
ENV TASK_TIMEOUT=300000
ENV HEADLESS=true

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "require('./dist/worker/health-check.js')"

# Switch to worker user
USER worker

# Expose port for health check endpoint (optional)
EXPOSE 3001

# Set the startup command
CMD ["node", "./dist/worker/worker.js"]