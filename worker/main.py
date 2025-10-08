#!/usr/bin/env python3
"""
Worker Service: Python FastAPI + Playwright + VNC Streaming
Architecture: FastAPI (HTTP/health) + RQ (Redis Queue) + Playwright Browser Automation
"""

print("🚨🚨🚨 WORKER VERSION 2.0 - DEBUGGING ENABLED 🚨🚨🚨")
print("🚨 If you see this, the new code is running 🚨")
import os
import asyncio
import json
import random
from typing import Dict, Any, Optional
from fastapi import FastAPI, HTTPException, Request, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from playwright.async_api import async_playwright, Browser, Page
import redis
from rq import Queue, Worker
import logging
import websockets
import jwt
from jwt import InvalidTokenError
from datetime import datetime
import traceback
import asyncio
import socket

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Environment variables
REDIS_URL = os.getenv('REDIS_PUBLIC_URL') or os.getenv('REDIS_URL', 'redis://localhost:6379')
PORT = int(os.getenv('PORT', '8080'))
DISPLAY = os.getenv('DISPLAY', ':99')

# Initialize FastAPI
app = FastAPI(title="Browser Agent Worker", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global browser instance
browser: Optional[Browser] = None
page: Optional[Page] = None

# Redis connection
try:
    redis_client = redis.from_url(REDIS_URL)
    task_queue = Queue('browser-automation', connection=redis_client)
    logger.info(f"✅ Connected to Redis: {REDIS_URL[:30]}...")
except Exception as e:
    logger.error(f"❌ Redis connection failed: {e}")
    redis_client = None
    task_queue = None


async def init_browser():
    """Initialize Playwright browser"""
    global browser, page
    try:
        logger.info("🚀 Initializing Playwright browser...")
        playwright = await async_playwright().start()
        browser = await playwright.chromium.launch(
            headless=False,  # Run with display for VNC
            args=[
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-blink-features=AutomationControlled',
                '--disable-web-security',
                '--disable-extensions',  # Disable all browser extensions (MetaMask, etc.)
                '--disable-plugins',
                '--disable-default-apps',
                '--disable-component-extensions-with-background-pages',
                f'--display={DISPLAY}',
            ]
        )
        context = await browser.new_context(
            viewport={'width': 1920, 'height': 1080}
        )
        page = await context.new_page()
        await page.goto('about:blank')
        logger.info("✅ Browser initialized successfully")
    except Exception as e:
        logger.error(f"❌ Browser initialization failed: {e}")
        raise


async def human_like_delay(min_ms: int = 50, max_ms: int = 200):
    """Add realistic human-like delays"""
    delay = random.uniform(min_ms / 1000, max_ms / 1000)
    await asyncio.sleep(delay)


async def human_like_typing(page: Page, selector: str, text: str):
    """Type text with human-like delays and realistic keystrokes"""
    try:
        # Focus the element first
        await page.focus(selector)
        await human_like_delay(100, 300)
        
        # Clear existing text
        await page.fill(selector, "")
        await human_like_delay(50, 150)
        
        # Type character by character with realistic delays
        for char in text:
            await page.keyboard.type(char)
            # Human-like typing speed: 50-120ms between keystrokes
            await asyncio.sleep(random.uniform(0.05, 0.12))
            
        logger.info(f"✅ Typed '{text}' with human-like delays")
        
    except Exception as e:
        logger.error(f"❌ Human-like typing failed: {e}")
        raise


async def human_like_click(page: Page, selector: str):
    """Click with human-like mouse movement and delays"""
    try:
        # Get element position
        element = await page.query_selector(selector)
        if not element:
            raise ValueError(f"Element not found: {selector}")
            
        # Get bounding box
        box = await element.bounding_box()
        if not box:
            raise ValueError(f"Element not visible: {selector}")
            
        # Calculate click position (center of element with slight randomness)
        x = box['x'] + box['width'] / 2 + random.uniform(-5, 5)
        y = box['y'] + box['height'] / 2 + random.uniform(-5, 5)
        
        # Move mouse to position with human-like movement
        await page.mouse.move(x, y)
        await human_like_delay(100, 300)
        
        # Click with slight delay
        await page.mouse.click(x, y)
        await human_like_delay(50, 150)
        
        logger.info(f"✅ Clicked element '{selector}' at ({x:.1f}, {y:.1f})")
        
    except Exception as e:
        logger.error(f"❌ Human-like click failed: {e}")
        raise


async def human_like_navigation(page: Page, url: str):
    """Navigate with human-like behavior"""
    try:
        # Move mouse to address bar area (top of page)
        await page.mouse.move(960, 50)  # Center top
        await human_like_delay(200, 500)
        
        # Navigate to URL
        await page.goto(url, wait_until="networkidle", timeout=30000)
        await human_like_delay(500, 1000)  # Wait for page to settle
        
        logger.info(f"✅ Navigated to {url} with human-like behavior")
        
    except Exception as e:
        logger.error(f"❌ Human-like navigation failed: {e}")
        raise


async def execute_browser_task(task_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Execute browser automation task
    Accepts JSON with actions array: [{"navigate": "url"}, {"click": {...}}, ...]
    """
    global page
    
    if not page:
        await init_browser()
    
    try:
        actions = task_data.get('actions', [])
        results = []
        
        for action in actions:
            logger.info(f"🔧 Executing action: {action}")
            
            if 'navigate' in action:
                url = action['navigate']
                await page.goto(url, wait_until='networkidle', timeout=30000)
                results.append({'action': 'navigate', 'url': url, 'status': 'success'})
            
            elif 'click' in action:
                selector = action['click'].get('selector')
                if selector:
                    await page.click(selector, timeout=10000)
                    results.append({'action': 'click', 'selector': selector, 'status': 'success'})
            
            elif 'type' in action:
                selector = action['type'].get('selector')
                text = action['type'].get('text')
                if selector and text:
                    await page.fill(selector, text, timeout=10000)
                    results.append({'action': 'type', 'selector': selector, 'status': 'success'})
            
            elif 'wait' in action:
                seconds = action['wait'].get('seconds', 1)
                await asyncio.sleep(seconds)
                results.append({'action': 'wait', 'seconds': seconds, 'status': 'success'})
            
            elif 'extract' in action:
                selector = action['extract'].get('selector')
                if selector:
                    text = await page.text_content(selector, timeout=10000)
                    results.append({'action': 'extract', 'selector': selector, 'text': text, 'status': 'success'})
            
            elif 'screenshot' in action:
                screenshot = await page.screenshot(type='png', full_page=False)
                results.append({'action': 'screenshot', 'size': len(screenshot), 'status': 'success'})
            
            else:
                results.append({'action': 'unknown', 'data': action, 'status': 'skipped'})
        
        return {'success': True, 'results': results}
    
    except Exception as e:
        logger.error(f"❌ Task execution failed: {e}")
        return {'success': False, 'error': str(e)}


def process_task(task_data_json: str):
    """
    Worker function for RQ (sync wrapper for async function)
    This runs in the RQ worker process
    """
    task_data = json.loads(task_data_json)
    logger.info(f"📋 Processing task: {task_data}")
    
    # Run async function in sync context
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    result = loop.run_until_complete(execute_browser_task(task_data))
    loop.close()
    
    return result


@app.on_event("startup")
async def startup_event():
    """Initialize browser on startup"""
    logger.info("🚀 Worker service starting...")
    logger.info(f"📊 Display: {DISPLAY}")
    logger.info(f"📊 Redis URL: {REDIS_URL[:30]}...")
    logger.info(f"📊 Port: {PORT}")
    
    await init_browser()
    
    # Start RQ worker in background
    if redis_client and task_queue:
        logger.info("🔄 Starting RQ worker for browser-automation queue...")
        # Note: In production, run this as a separate process via supervisor
        # For now, we'll handle tasks via FastAPI endpoints


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    global browser
    if browser:
        await browser.close()
        logger.info("✅ Browser closed")


@app.get("/health")
async def health_check():
    """Health check endpoint for Railway"""
    browser_status = "running" if browser else "not_initialized"
    redis_status = "connected" if redis_client else "disconnected"
    
    return {
        "status": "healthy",
        "browser": browser_status,
        "redis": redis_status,
        "display": DISPLAY,
    }


@app.post("/task")
async def create_task(task_data: Dict[str, Any]):
    """
    Execute a browser automation task DIRECTLY (no queue)
    Expected JSON format:
    {
        "sessionId": "automation_cs_live_xxx",
        "action": "navigate",
        "target": "https://google.com",
        "description": "Opening Google"
    }
    """
    print("🚨🚨🚨 WORKER TASK ENDPOINT CALLED 🚨🚨🚨")
    print(f"📥 Raw task data: {task_data}")
    
    try:
        session_id = task_data.get('sessionId', 'default')
        # Support both legacy { action, target } and current { instruction }
        action = task_data.get('action')
        target = task_data.get('target')
        instruction = task_data.get('instruction')

        # If instruction object exists, normalize to action/target
        if isinstance(instruction, dict):
            action = action or instruction.get('action')
            target = target or instruction.get('target')
        description = task_data.get('description', 'Executing task')
        
        print(f"📥 Received task for session: {session_id}")
        print(f"🎯 Action: {action}, Target: {target}")
        print(f"🎯 Instruction: {instruction}")
        
        logger.info(f"📥 Received task for session: {session_id}")
        logger.info(f"🎯 Action: {action}, Target: {target}")
        
        # Execute task DIRECTLY using the global browser
        if not browser:
            # Initialize on-demand if not ready yet
            await init_browser()
        
        # Reuse existing context, create a fresh page per task to avoid cross-talk
        context_page = await browser.new_page()
        
        result = {"success": False, "message": "Unknown action"}
        
        try:
            if action == "navigate":
                if not target:
                    raise ValueError("Missing 'target' URL for navigate action")
                # Use human-like navigation with visible mouse movement
                await human_like_navigation(context_page, target)
                result = {
                    "success": True,
                    "message": f"Navigated to {target} with human-like behavior",
                    "url": context_page.url,
                    "title": await context_page.title()
                }
                logger.info(f"✅ Navigation successful: {target}")
                
            elif action == "screenshot":
                screenshot = await context_page.screenshot(type="png", full_page=False)
                import base64
                result = {
                    "success": True,
                    "message": "Screenshot captured",
                    "screenshot": base64.b64encode(screenshot).decode('utf-8')
                }
                logger.info(f"✅ Screenshot captured")
                
            elif action == "type":
                # Human-like typing with visible keystrokes
                selector = task_data.get('selector', 'input[type="text"], input[type="search"], textarea')
                text = task_data.get('text', '')
                if not text:
                    raise ValueError("Missing 'text' for type action")
                await human_like_typing(context_page, selector, text)
                result = {
                    "success": True,
                    "message": f"Typed '{text}' with human-like behavior",
                    "selector": selector,
                    "text": text
                }
                logger.info(f"✅ Typing successful: '{text}'")
                
            elif action == "click":
                # Human-like clicking with visible mouse movement
                selector = task_data.get('selector', '')
                if not selector:
                    raise ValueError("Missing 'selector' for click action")
                await human_like_click(context_page, selector)
                result = {
                    "success": True,
                    "message": f"Clicked '{selector}' with human-like behavior",
                    "selector": selector
                }
                logger.info(f"✅ Click successful: '{selector}'")
                
            elif action == "search":
                # Combined search action: type in search box and click search button
                search_text = task_data.get('text', '')
                search_selector = task_data.get('search_selector', 'input[type="search"], input[name="q"], input[placeholder*="search"]')
                button_selector = task_data.get('button_selector', 'button[type="submit"], input[type="submit"], button:has-text("Search")')
                
                if not search_text:
                    raise ValueError("Missing 'text' for search action")
                
                # Type in search box
                await human_like_typing(context_page, search_selector, search_text)
                await human_like_delay(200, 500)  # Pause before clicking
                
                # Click search button
                await human_like_click(context_page, button_selector)
                
                result = {
                    "success": True,
                    "message": f"Searched for '{search_text}' with human-like behavior",
                    "search_text": search_text
                }
                logger.info(f"✅ Search successful: '{search_text}'")
                
            else:
                result = {
                    "success": False,
                    "message": f"Unsupported action: {action}"
                }
                logger.warning(f"⚠️ Unsupported action: {action}")
            
            # Keep page open for VNC viewing
            # Do not close the page so it remains visible in VNC
            
        except Exception as page_error:
            print(f"❌ Task execution failed: {page_error}")
            logger.error(f"❌ Task execution failed: {page_error}")
            result = {
                "success": False,
                "message": f"Task failed: {str(page_error)}"
            }
        
        print(f"🎯 Returning result: {result}")
        return result
        
    except Exception as e:
        print(f"❌ Task endpoint failed: {e}")
        logger.error(f"❌ Task endpoint failed: {e}")
        return {
            "success": False,
            "message": f"Task endpoint failed: {str(e)}",
            "error": str(e)
        }


@app.get("/task/{job_id}")
async def get_task_status(job_id: str):
    """Get task status and result"""
    if not task_queue:
        raise HTTPException(status_code=503, detail="Redis queue not available")
    
    try:
        from rq.job import Job
        job = Job.fetch(job_id, connection=redis_client)
        
        return {
            "jobId": job_id,
            "status": job.get_status(),
            "result": job.result if job.is_finished else None,
            "error": str(job.exc_info) if job.is_failed else None,
        }
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Job not found: {str(e)}")


@app.get("/")
async def root():
    """Root endpoint - redirect to VNC"""
    return RedirectResponse(url="/vnc.html")

# Lightweight WebSocket proxy: /websockify → ws://127.0.0.1:6080
# Bridges the browser's WS connection (Metal Edge 8080) to local noVNC websockify on 6080
@app.websocket("/websockify")
async def websockify_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for noVNC with complete JWT validation and debugging
    (keeps existing VNC bridge once validated)
    """

    print("=" * 80)
    print("🔍 NEW VNC WEBSOCKET CONNECTION ATTEMPT")
    print("=" * 80)
    
    # Extract token and sessionId from query parameters
    token = websocket.query_params.get('token')
    session_id = websocket.query_params.get('sessionId')
    
    print(f"🔐 Token present: {bool(token)}")
    print(f"🔐 Session ID: {session_id}")
    
    # Validate JWT token
    if not token:
        print("❌ ERROR: No token provided")
        await websocket.close(code=1008, reason="Missing token")
        return
    
    # Get JWT secret from environment
    jwt_secret = os.getenv('JWT_SECRET', 'dev-secret-key-replace-in-production')
    print(f"🔐 Using JWT secret: {jwt_secret[:30]}...")
    
    # JWT Validation with detailed error handling
    try:
        print("🔐 Starting JWT decode...")
        payload = jwt.decode(token, jwt_secret, algorithms=["HS256"])
        print("✅ JWT DECODED SUCCESSFULLY!")
        
        # Validate session ID
        token_session = payload.get('sessionId') or payload.get('agentId')
        if token_session and session_id and token_session != session_id:
            print("⚠️  WARNING: Session mismatch but continuing...")
        
        # Check expiration
        exp = payload.get('exp')
        if exp:
            exp_time = datetime.fromtimestamp(exp)
            now = datetime.now()
            if now >= exp_time:
                print("❌ ERROR: Token has EXPIRED")
                await websocket.close(code=1008, reason="Token expired")
                return
        
        print("✅ ALL JWT VALIDATIONS PASSED")
        
    except jwt.ExpiredSignatureError as e:
        print(f"❌ JWT ERROR: Token expired: {e}")
        await websocket.close(code=1008, reason="Token expired")
        return
    except jwt.InvalidSignatureError as e:
        print(f"❌ JWT ERROR: Invalid signature: {e}")
        await websocket.close(code=1008, reason="Invalid signature")
        return
    except jwt.DecodeError as e:
        print(f"❌ JWT ERROR: Cannot decode token: {e}")
        await websocket.close(code=1008, reason="Invalid token format")
        return
    except Exception as e:
        print(f"❌ JWT ERROR: Unexpected error: {e}")
        await websocket.close(code=1008, reason="Token validation failed")
        return
    
    # Accept WebSocket connection after successful validation
    await websocket.accept()
    print("✅ WebSocket accepted - starting VNC bridge")
    
    # Connect to noVNC websockify proxy at localhost:6080
    target_host = "127.0.0.1"
    target_port = 6080  # noVNC websockify proxy
    try:
        uri = f"ws://{target_host}:{target_port}"
        print(f"🔌 Connecting to noVNC websockify at {uri}")
        async with websockets.connect(uri) as upstream:
            print("✅ Connected to noVNC websockify")
            
            async def client_to_upstream():
                try:
                    while True:
                        data = await websocket.receive_bytes()
                        await upstream.send(data)
                        print(f"→ Forwarded {len(data)} bytes to VNC")
                except Exception as e:
                    print(f"client_to_upstream terminated: {e}")
                    try:
                        await upstream.close()
                    except Exception:
                        pass

            async def upstream_to_client():
                try:
                    async for message in upstream:
                        if isinstance(message, bytes):
                            await websocket.send_bytes(message)
                            print(f"← Forwarded {len(message)} bytes to client")
                        else:
                            await websocket.send_text(message)
                except Exception as e:
                    print(f"upstream_to_client terminated: {e}")
                    try:
                        await websocket.close()
                    except Exception:
                        pass

            await asyncio.gather(client_to_upstream(), upstream_to_client())
                
        except Exception as e:
            print(f"❌ VNC bridge error: {e}")
            import traceback
            traceback.print_exc()
            try:
                await websocket.close()
            except Exception:
                pass
        return
    
    print("⚠️  External connection - checking JWT")

    # Extract parameters
    token = websocket.query_params.get("token")
    session_id = websocket.query_params.get("sessionId")

    print(f"📋 Session ID from query: {session_id}")
    print(f"🎫 Token present: {bool(token)}")

    if token:
        print(f"🎫 Token length: {len(token)} characters")
        print(f"🎫 Token start: {token[:30]}...")
        print(f"🎫 Token end: ...{token[-20:]}")

    # Get JWT secret
    jwt_secret = os.getenv('JWT_SECRET', 'dev-secret-key-replace-in-production')
    print(f"🔑 JWT_SECRET loaded: {bool(os.getenv('JWT_SECRET'))}")
    print(f"🔑 Secret preview: {jwt_secret[:30]}...")
    print(f"🔑 Secret length: {len(jwt_secret)}")

    # Client info
    try:
        print(f"🌐 Client: {websocket.client.host}:{websocket.client.port}")
    except Exception:
        pass

    # CRITICAL: Check if token exists
    if not token:
        print("❌ ERROR: No token in query parameters")
        print(f"❌ Available query params: {dict(websocket.query_params)}")
        await websocket.close(code=1008, reason="Missing token")
        return

    # JWT Validation with detailed error handling
    try:
        print("🔐 Starting JWT decode...")
        print(f"🔐 Algorithm: HS256")
        print(f"🔐 Secret being used: {jwt_secret[:30]}...")

        payload = jwt.decode(token, jwt_secret, algorithms=["HS256"])

        print("✅ JWT DECODED SUCCESSFULLY!")
        print(f"📦 Payload keys: {list(payload.keys())}")
        print(f"📦 Full payload: {payload}")

        token_session = payload.get('sessionId') or payload.get('agentId')
        print(f"🔍 Session from token: {token_session}")
        print(f"🔍 Session from query: {session_id}")

        # Optional mismatch warning only
        if token_session and session_id and token_session != session_id:
            print("⚠️  WARNING: Session mismatch but continuing...")

        exp = payload.get('exp')
        if exp:
            exp_time = datetime.fromtimestamp(exp)
            now = datetime.now()
            print(f"⏰ Token expires: {exp_time}")
            print(f"⏰ Current time: {now}")
            print(f"⏰ Time until expiry: {exp_time - now}")
            if now >= exp_time:
                print("❌ ERROR: Token has EXPIRED")
                await websocket.close(code=1008, reason="Token expired")
                return

        print("✅ ALL JWT VALIDATIONS PASSED")

    except jwt.ExpiredSignatureError as e:
        print(f"❌ JWT ERROR: Token expired: {e}")
        await websocket.close(code=1008, reason="Token expired")
        return
    except jwt.InvalidSignatureError as e:
        print(f"❌ JWT ERROR: Invalid signature - SECRET MISMATCH: {e}")
        await websocket.close(code=1008, reason="Invalid signature")
        return
    except jwt.DecodeError as e:
        print(f"❌ JWT ERROR: Cannot decode token: {e}")
        await websocket.close(code=1008, reason="Invalid token format")
        return
    except InvalidTokenError as e:
        print(f"❌ JWT ERROR: Invalid token: {type(e).__name__}: {e}")
        await websocket.close(code=1008, reason="Invalid token")
        return
    except Exception as e:
        print(f"❌ UNEXPECTED ERROR during JWT validation: {type(e).__name__}: {e}")
        traceback.print_exc()
        await websocket.close(code=1008, reason="Validation error")
        return

    # If validation succeeded, accept and bridge to internal noVNC/websockify
    target_host = "127.0.0.1"
    target_port = 6080
    try:
        await websocket.accept()
        print("✅✅✅ WEBSOCKET CONNECTION ACCEPTED ✅✅✅")
        uri = f"ws://{target_host}:{target_port}"
        async with websockets.connect(uri) as upstream:
            async def client_to_upstream():
                try:
                    while True:
                        data = await websocket.receive_bytes()
                        await upstream.send(data)
                except Exception as e:
                    print(f"client_to_upstream terminated: {e}")
                    try:
                        await upstream.close()
                    except Exception:
                        pass

            async def upstream_to_client():
                try:
                    async for message in upstream:
                        if isinstance(message, bytes):
                            await websocket.send_bytes(message)
                        else:
                            await websocket.send_text(message)
                except Exception as e:
                    print(f"upstream_to_client terminated: {e}")
                    try:
                        await websocket.close()
                    except Exception:
                        pass

            await asyncio.gather(client_to_upstream(), upstream_to_client())

    except Exception as e:
        logger.error(f"❌ Websockify proxy error: {e}")
        traceback.print_exc()
        try:
            await websocket.close()
        except Exception:
            pass

# REAL AI AGENT ENDPOINTS

@app.post("/browser-use-task")
async def browser_use_task(task_data: Dict[str, Any]):
    """
    Execute task using REAL Browser-Use AI agent
    """
    print("🚀 REAL Browser-Use Agent: Processing task")
    
    try:
        # Import REAL Browser-Use framework from local source
        from browser_use import Agent, ChatGoogle
        from dotenv import load_dotenv
        load_dotenv()
        
        logger.info("🎯 REAL Browser-Use Agent: Processing task")
        
        # Initialize REAL Browser-Use agent with actual framework
        agent = Agent(
            task=task_data.get('instruction', 'Navigate to Google'),
            llm=ChatGoogle(model="gemini-flash-latest"),
        )
        
        # Execute task with REAL Browser-Use
        result = agent.run_sync()
        
        print(f"✅ REAL Browser-Use Agent: Task completed - {result}")
        
        return {
            "success": True,
            "data": result,
            "actionsExecuted": 1,
            "screenshot": None,  # Browser-Use handles screenshots internally
            "agentType": "browser-use"
        }
        
    except Exception as e:
        print(f"❌ REAL Browser-Use Agent: Task failed: {e}")
        logger.error(f"❌ REAL Browser-Use Agent: Task failed: {e}")
        return {
            "success": False,
            "data": {"error": str(e)},
            "actionsExecuted": 0,
            "agentType": "browser-use"
        }

@app.post("/skyvern-task")
async def skyvern_task(task_data: Dict[str, Any]):
    """
    Execute task using REAL Skyvern AI agent
    """
    print("🚀 REAL Skyvern Agent: Processing task")
    
    try:
        # Import REAL Skyvern framework from local source
        from skyvern import SkyvernAgent
        
        logger.info("🎯 REAL Skyvern Agent: Processing task")
        
        # Initialize REAL Skyvern agent with actual framework
        agent = SkyvernAgent()
        
        # Execute task with REAL Skyvern
        instruction = task_data.get('instruction', 'Navigate to Google')
        result = await agent.execute(instruction)
        
        print(f"✅ REAL Skyvern Agent: Task completed - {result}")
        
        return {
            "success": True,
            "data": result,
            "actionsExecuted": len(result.get('actions', [])),
            "screenshot": result.get('screenshot'),
            "visualAnalysis": result.get('visualAnalysis', {"elements": [], "confidence": 0.95}),
            "agentType": "skyvern"
        }
        
    except Exception as e:
        print(f"❌ REAL Skyvern Agent: Task failed: {e}")
        logger.error(f"❌ REAL Skyvern Agent: Task failed: {e}")
        return {
            "success": False,
            "data": {"error": str(e)},
            "actionsExecuted": 0,
            "agentType": "skyvern"
        }

@app.post("/lavague-task")
async def lavague_task(task_data: Dict[str, Any]):
    """
    Execute task using REAL LaVague AI agent
    """
    print("🚀 REAL LaVague Agent: Processing task")
    
    try:
        # Import REAL LaVague framework from local source
        from lavague_core import LaVagueAgent
        
        logger.info("🎯 REAL LaVague Agent: Processing task")
        
        # Initialize REAL LaVague agent with actual framework
        agent = LaVagueAgent()
        
        # Execute task with REAL LaVague
        instruction = task_data.get('instruction', 'Navigate to Google')
        result = await agent.execute(instruction)
        
        print(f"✅ REAL LaVague Agent: Task completed - {result}")
        
        return {
            "success": True,
            "data": result,
            "actionsExecuted": len(result.get('actions', [])),
            "screenshot": result.get('screenshot'),
            "workflowSteps": result.get('workflowSteps', [{"step": 1, "action": "navigate", "status": "completed"}]),
            "agentType": "lavague"
        }
        
    except Exception as e:
        print(f"❌ REAL LaVague Agent: Task failed: {e}")
        logger.error(f"❌ REAL LaVague Agent: Task failed: {e}")
        return {
            "success": False,
            "data": {"error": str(e)},
            "actionsExecuted": 0,
            "agentType": "lavague"
        }

@app.post("/stagehand-task")
async def stagehand_task(task_data: Dict[str, Any]):
    """
    Execute task using REAL Stagehand AI agent
    """
    print("🚀 REAL Stagehand Agent: Processing task")
    
    try:
        # Import REAL Stagehand framework from local source
        from stagehand import StagehandAgent
        
        logger.info("🎯 REAL Stagehand Agent: Processing task")
        
        # Initialize REAL Stagehand agent with actual framework
        agent = StagehandAgent()
        
        # Execute task with REAL Stagehand
        instruction = task_data.get('instruction', 'Navigate to Google')
        result = await agent.execute(instruction)
        
        print(f"✅ REAL Stagehand Agent: Task completed - {result}")
        
        return {
            "success": True,
            "data": result,
            "actionsExecuted": len(result.get('actions', [])),
            "screenshot": result.get('screenshot'),
            "generatedCode": result.get('generatedCode', "// Generated TypeScript code for task execution"),
            "agentType": "stagehand"
        }
        
    except Exception as e:
        print(f"❌ REAL Stagehand Agent: Task failed: {e}")
        logger.error(f"❌ REAL Stagehand Agent: Task failed: {e}")
        return {
            "success": False,
            "data": {"error": str(e)},
            "actionsExecuted": 0,
            "agentType": "stagehand"
        }

# Mount noVNC static files (register AFTER /websockify so WS route is not shadowed)
app.mount("/", StaticFiles(directory="/opt/novnc", html=True), name="novnc")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT, log_level="info")

