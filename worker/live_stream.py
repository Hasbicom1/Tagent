"""
FREE Live Browser Streaming using Playwright CDP
Based on Browserless.io open-source implementation
"""

from playwright.async_api import async_playwright
import asyncio
import websockets
import json

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
        # Connect to main backend
        self.ws = await websockets.connect(self.backend_ws_url)
        print(f"✅ Connected to backend: {self.backend_ws_url}")
        
        # Start Playwright
        self.playwright = await async_playwright().start()
        self.browser = await self.playwright.chromium.launch(
            headless=True,
            args=['--no-sandbox', '--disable-setuid-sandbox']
        )
        
        # Create page
        self.page = await self.browser.new_page(
            viewport={'width': 1280, 'height': 720}
        )
        
        # Get CDP session
        self.cdp = await self.page.context.new_cdp_session(self.page)
        
        # Start screencast - THIS IS THE KEY!
        await self.cdp.send('Page.startScreencast', {
            'format': 'jpeg',
            'quality': 75,
            'maxWidth': 1280,
            'maxHeight': 720,
            'everyNthFrame': 1
        })
        
        # Listen for frames
        self.cdp.on('Page.screencastFrame', self._on_frame)
        
        print(f"✅ Live streaming started for session: {self.session_id}")
        
    async def _on_frame(self, params):
        """Handle each frame from CDP"""
        try:
            # Send frame to backend
            await self.ws.send(json.dumps({
                'type': 'frame',
                'sessionId': self.session_id,
                'data': params['data'],  # Base64 JPEG
                'timestamp': params['metadata']['timestamp']
            }))
            
            # Acknowledge frame (CRITICAL - must do this!)
            await self.cdp.send('Page.screencastFrameAck', {
                'sessionId': params['sessionId']
            })
        except Exception as e:
            print(f"❌ Frame error: {e}")
    
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
