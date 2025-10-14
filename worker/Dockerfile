FROM python:3.11-slim-bookworm

# Set platform for multi-arch builds
ARG TARGETPLATFORM
ARG NODE_MAJOR=20

# Install system dependencies including Node.js
RUN apt-get update && apt-get install -y \
    wget \
    netcat-traditional \
    gnupg \
    curl \
    unzip \
    xvfb \
    libxss1 \
    libnss3 \
    libnspr4 \
    libasound2 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    xdg-utils \
    fonts-liberation \
    fonts-noto-color-emoji \
    fonts-unifont \
    dbus \
    xauth \
    x11vnc \
    tigervnc-tools \
    supervisor \
    net-tools \
    procps \
    git \
    python3-numpy \
    fontconfig \
    fonts-dejavu \
    fonts-dejavu-core \
    fonts-dejavu-extra \
    vim \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR}.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install noVNC and websockify - CORRECTED VERSION
RUN git clone https://github.com/novnc/noVNC.git /opt/novnc \
    && ln -s /opt/novnc/vnc.html /opt/novnc/index.html \
    && pip install websockify \
    && chmod -R 755 /opt/novnc \
    && which websockify \
    && websockify --help \
    && echo "✅ noVNC and websockify installation completed"

# Set up working directory
WORKDIR /app

# Copy requirements and install Python dependencies first (for better caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install TypeScript dependencies if needed
RUN npm install -g typescript tsx

# Playwright setup with proper browser installation
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-browsers
RUN mkdir -p $PLAYWRIGHT_BROWSERS_PATH \
    && PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=0 playwright install chromium \
    && playwright install-deps chromium

# Copy application code
COPY . .

# Install Node.js dependencies if package.json exists
RUN if [ -f "package.json" ]; then npm install; fi

# Set up supervisor configuration
RUN mkdir -p /var/log/supervisor \
    && mkdir -p /etc/supervisor/conf.d
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Create necessary directories and set permissions
RUN mkdir -p /tmp \
    && chmod 1777 /tmp \
    && mkdir -p /var/run/supervisor \
    && chmod 755 /var/run/supervisor \
    && mkdir -p /var/log/supervisor

# Set environment variables
ENV DISPLAY=:99
ENV PYTHONUNBUFFERED=1
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Expose ports:
# 8080 - FastAPI worker
# 6080 - noVNC web interface  
# 5900 - x11vnc direct VNC
# 9222 - Chrome debugging (optional)
EXPOSE 8080 6080 5900 9222

# Use exec form for better signal handling
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
