"""
FREE Live Browser Streaming using Playwright CDP
Based on Browserless.io open-source implementation
"""

from playwright.async_api import async_playwright
import asyncio
import websockets
import json
import logging
import redis
from urllib.parse import urlparse
import os
import time
from datetime import datetime

# Configure logging for live stream
logger = logging.getLogger(__name__)

class LiveBrowserStream:
    def __init__(self, session_id, backend_ws_url):
        self.session_id = session_id
        self.backend_ws_url = backend_ws_url
        self.ws = None
        self.playwright = None
        self.browser = None
        self.page = None
        self.cdp = None
        
        # Get Redis connection (prefer private URL)
        redis_url = os.getenv('REDIS_PRIVATE_URL') or os.getenv('REDIS_URL')

        if redis_url:
            parsed = urlparse(redis_url)
            # Debug: show parsed URL components
            print(f"[REDIS DEBUG] Parsed URL:")
            print(f"  hostname: {parsed.hostname}")
            print(f"  port: {parsed.port}")
            print(f"  username: {parsed.username}")
            print(f"  password: {'***' if parsed.password else None}")

            # Build connection kwargs per requested spec
            redis_kwargs = {
                'host': parsed.hostname or 'redis.railway.internal',
                'port': parsed.port or 6379,
                'decode_responses': True,
            }
            if parsed.password:
                redis_kwargs['password'] = parsed.password

            # CRITICAL: Always set username (Railway requires 'default')
            redis_kwargs['username'] = parsed.username if parsed.username else 'default'

            print(f"[REDIS DEBUG] Final kwargs keys: {list(redis_kwargs.keys())}")
            print(f"[REDIS DEBUG] Username being used: {redis_kwargs.get('username')}")

            self.redis_client = redis.Redis(**redis_kwargs)
        else:
            # Fallback to individual environment variables
            redis_host = os.getenv('REDISHOST', 'redis.railway.internal')
            redis_port = int(os.getenv('REDISPORT', '6379'))
            redis_password = os.getenv('REDIS_PASSWORD')
            redis_username = 'default'  # Railway Redis requires username
            
            print(f"[REDIS] Using individual env vars:")
            print(f"  Host: {redis_host}")
            print(f"  Port: {redis_port}")
            print(f"  Has Password: {bool(redis_password)}")
            print(f"  Username: {redis_username}")
            
            self.redis_client = redis.Redis(
                host=redis_host,
                port=redis_port,
                password=redis_password,
                username=redis_username,
                decode_responses=True,
                socket_connect_timeout=5
            )
            
            # Test connection
            try:
                self.redis_client.ping()
                print(f"✅ [REDIS] Fallback connection successful")
            except Exception as e:
                print(f"❌ [REDIS] Fallback connection failed: {e}")
                raise
        
    async def start(self):
        """Initialize browser and start streaming"""
        logger.info(f"🎬 STREAM: Starting live browser stream for session: {self.session_id}")

        try:
            # Connect to main backend
            logger.info(f"🔌 STREAM: Connecting to backend WebSocket: {self.backend_ws_url}")
            # Add Origin header for security validation (required by backend)
            origin = (
                os.getenv('BACKEND_ORIGIN')
                or (
                    'https://www.onedollaragent.ai'
                    if (os.getenv('NODE_ENV') == 'production' or os.getenv('RAILWAY_ENVIRONMENT') == 'production')
                    else 'http://localhost:8080'
                )
            )
            # Include a browser-like User-Agent to avoid WAF blocks (e.g., Cloudflare)
            ua = (
                os.getenv('STREAMING_UA')
                or 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
                   '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            )
            self.ws = await websockets.connect(
                self.backend_ws_url,
                additional_headers={
                    'Origin': origin,
                    'User-Agent': ua,
                    'Pragma': 'no-cache',
                    'Cache-Control': 'no-cache'
                }
            )
            logger.info(f"✅ STREAM: Connected to backend: {self.backend_ws_url}")
            
            # Start Playwright with enhanced args for Railway deployment
            logger.info("🎭 STREAM: Starting Playwright...")
            self.playwright = await async_playwright().start()
            logger.info("✅ STREAM: Playwright started successfully")
            
            # Enhanced browser launch args for Railway/production
            browser_args = [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--disable-features=TranslateUI',
                '--disable-ipc-flooding-protection',
                '--disable-extensions',
                '--disable-plugins',
                '--disable-default-apps',
                '--disable-sync',
                '--disable-translate',
                '--hide-scrollbars',
                '--mute-audio',
                '--no-default-browser-check',
                '--no-pings',
                '--password-store=basic',
                '--use-mock-keychain',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor'
            ]
            
            logger.info(f"🚀 STREAM: Launching Chromium with {len(browser_args)} args...")
            self.browser = await self.playwright.chromium.launch(
                headless=True,
                args=browser_args
            )
            logger.info("✅ STREAM: Chromium browser launched successfully")
            
            # Create page with proper viewport
            logger.info("📄 STREAM: Creating new page...")
            self.page = await self.browser.new_page(
                viewport={'width': 1280, 'height': 720}
            )
            logger.info("✅ STREAM: Page created successfully")
            
            # Get CDP session
            logger.info("🔗 STREAM: Creating CDP session...")
            self.cdp = await self.page.context.new_cdp_session(self.page)
            logger.info("✅ STREAM: CDP session created successfully")
            
            # Start screencast - THIS IS THE KEY!
            logger.info("📹 STREAM: Starting screencast...")
            await self.cdp.send('Page.startScreencast', {
                'format': 'jpeg',
                'quality': 75,
                'maxWidth': 1280,
                'maxHeight': 720,
                'everyNthFrame': 1
            })
            logger.info("✅ STREAM: Screencast started successfully")
            
            # Listen for frames
            self.cdp.on('Page.screencastFrame', self._on_frame)
            logger.info("👂 STREAM: Frame listener attached")
            
            # CRITICAL FIX: Update Redis session status to mark browser as ready
            try:
                self.redis_client.hset(f'session:{self.session_id}', mapping={
                    'browser_ready': 'true',
                    'worker_ready': 'true',
                    'workerConnected': 'true',
                    'status': 'active',
                    'stream_started_at': str(int(time.time()))
                })
                logger.info(f"✅ STREAM: Redis session status updated - browser ready for session: {self.session_id}")
            except Exception as redis_error:
                logger.error(f"❌ STREAM: Failed to update Redis session status: {redis_error}")
            
            logger.info(f"✅ STREAM: Live streaming started successfully for session: {self.session_id}")
            
        except Exception as e:
            logger.error(f"❌ STREAM: Failed to start live stream for session {self.session_id}: {e}")
            logger.error(f"❌ STREAM: Error details: {type(e).__name__}: {str(e)}")
            raise
        
    async def _on_frame(self, params):
        """Handle each frame from CDP"""
        try:
            # Create frame message
            frame_data = {
                'type': 'frame',
                'sessionId': self.session_id,
                'data': params['data'],  # Base64 JPEG
                'timestamp': params['metadata']['timestamp']
            }
            
            # CRITICAL FIX: Publish frame to Redis for backend to forward
            try:
                self.redis_client.publish(
                    f'browser:frames:{self.session_id}',
                    json.dumps(frame_data)
                )
                logger.debug(f"📤 STREAM: Frame published to Redis for session {self.session_id}")
            except Exception as redis_error:
                logger.error(f"❌ STREAM: Redis publish failed: {redis_error}")
            
            # Also send to backend WebSocket (fallback)
            if self.ws:
                try:
                    await self.ws.send(json.dumps(frame_data))
                    logger.debug(f"📤 STREAM: Frame sent to backend WebSocket for session {self.session_id}")
                except Exception as ws_error:
                    logger.error(f"❌ STREAM: WebSocket send failed: {ws_error}")
            
            # Acknowledge frame (CRITICAL - must do this!)
            await self.cdp.send('Page.screencastFrameAck', {
                'sessionId': params['sessionId']
            })
            logger.debug(f"✅ STREAM: Frame acknowledged for session {self.session_id}")
            
        except Exception as e:
            logger.error(f"❌ STREAM: Frame error for session {self.session_id}: {e}")
            logger.error(f"❌ STREAM: Frame error details: {type(e).__name__}: {str(e)}")
    
    # AI Agent Methods
    async def navigate(self, url):
        """Navigate to URL"""
        await self.page.goto(url)
        
    async def click(self, selector):
        """Click element"""
        await self.page.click(selector)
        
    async def type(self, selector, text):
        """Type text"""
        await self.page.type(selector, text)
        
    async def scroll(self, x, y):
        """Scroll page"""
        await self.page.evaluate(f'window.scrollBy({x}, {y})')
    
    async def stop(self):
        """Stop streaming"""
        if self.cdp:
            await self.cdp.send('Page.stopScreencast')
        if self.browser:
            await self.browser.close()
        if self.ws:
            await self.ws.close()
