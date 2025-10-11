"""
FREE Live Browser Streaming using Playwright CDP
Based on Browserless.io open-source implementation
"""

from playwright.async_api import async_playwright
import asyncio
import websockets
import json
import logging
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
        
    async def start(self):
        """Initialize browser and start streaming"""
        logger.info(f"🎬 STREAM: Starting live browser stream for session: {self.session_id}")
        
        try:
            # Connect to main backend
            logger.info(f"🔌 STREAM: Connecting to backend WebSocket: {self.backend_ws_url}")
            self.ws = await websockets.connect(self.backend_ws_url)
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
            
            logger.info(f"✅ STREAM: Live streaming started successfully for session: {self.session_id}")
            
        except Exception as e:
            logger.error(f"❌ STREAM: Failed to start live stream for session {self.session_id}: {e}")
            logger.error(f"❌ STREAM: Error details: {type(e).__name__}: {str(e)}")
            raise
        
    async def _on_frame(self, params):
        """Handle each frame from CDP"""
        try:
            # Send frame to backend
            frame_data = {
                'type': 'frame',
                'sessionId': self.session_id,
                'data': params['data'],  # Base64 JPEG
                'timestamp': params['metadata']['timestamp']
            }
            
            await self.ws.send(json.dumps(frame_data))
            logger.debug(f"📤 STREAM: Frame sent for session {self.session_id}")
            
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
