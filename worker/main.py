#!/usr/bin/env python3
"""
Worker Service: Python FastAPI + Playwright + VNC Streaming
Architecture: FastAPI (HTTP/health) + RQ (Redis Queue) + Playwright Browser Automation
"""
import os
import asyncio
import json
from typing import Dict, Any, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from playwright.async_api import async_playwright, Browser, Page
import redis
from rq import Queue, Worker
import logging

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
    try:
        session_id = task_data.get('sessionId', 'default')
        action = task_data.get('action')
        target = task_data.get('target')
        description = task_data.get('description', 'Executing task')
        
        logger.info(f"📥 Received task for session: {session_id}")
        logger.info(f"🎯 Action: {action}, Target: {target}")
        
        # Execute task DIRECTLY using the global browser
        if not browser_instance:
            raise HTTPException(status_code=503, detail="Browser not initialized")
        
        # Create a new page for this session
        page = await browser_instance.new_page()
        
        result = {"success": False, "message": "Unknown action"}
        
        try:
            if action == "navigate":
                await page.goto(target, wait_until="networkidle", timeout=30000)
                result = {
                    "success": True,
                    "message": f"Navigated to {target}",
                    "url": page.url,
                    "title": await page.title()
                }
                logger.info(f"✅ Navigation successful: {target}")
                
            elif action == "screenshot":
                screenshot = await page.screenshot(type="png", full_page=False)
                import base64
                result = {
                    "success": True,
                    "message": "Screenshot captured",
                    "screenshot": base64.b64encode(screenshot).decode('utf-8')
                }
                logger.info(f"✅ Screenshot captured")
                
            else:
                result = {
                    "success": False,
                    "message": f"Unsupported action: {action}"
                }
                logger.warning(f"⚠️ Unsupported action: {action}")
            
            # Keep page open for VNC viewing
            # await page.close()  # Comment out to keep page visible in VNC
            
        except Exception as page_error:
            logger.error(f"❌ Task execution failed: {page_error}")
            result = {
                "success": False,
                "message": f"Task failed: {str(page_error)}"
            }
        
        return result
        
    except Exception as e:
        logger.error(f"❌ Task endpoint failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


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

# Mount noVNC static files
app.mount("/", StaticFiles(directory="/opt/novnc", html=True), name="novnc")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT, log_level="info")

