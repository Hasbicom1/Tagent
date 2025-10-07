FROM python:3.11-slim-bookworm

# Set platform for multi-arch builds
ARG TARGETPLATFORM
ARG NODE_MAJOR=20

# Install system dependencies
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
    && rm -rf /var/lib/apt/lists/*

# Install noVNC
RUN git clone https://github.com/novnc/noVNC.git /opt/novnc \
    && git clone https://github.com/novnc/websockify /opt/novnc/utils/websockify \
    && ln -s /opt/novnc/vnc.html /opt/novnc/index.html

# Set up working directory
WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Playwright setup
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-browsers
RUN mkdir -p $PLAYWRIGHT_BROWSERS_PATH

# Install Chromium via Playwright
RUN PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=0 playwright install chromium

# Copy application code
COPY . .

# Set up supervisor configuration
RUN mkdir -p /var/log/supervisor
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Expose ports:
# 8080 - FastAPI worker
# 6080 - noVNC web interface
# 5901 - x11vnc direct VNC
# 9222 - Chrome debugging (optional)
EXPOSE 8080 6080 5901 9222

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
