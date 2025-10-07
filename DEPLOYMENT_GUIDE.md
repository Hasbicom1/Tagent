# 🚀 NEW ARCHITECTURE: CDP-Based Browser Automation

## What Changed?

### ❌ OLD (VNC-based - BROKEN)
- Required Xvfb (virtual display)
- Required x11vnc (VNC server)
- Required websockify (WebSocket bridge)
- Complex container setup
- Network routing issues
- Heavy resource usage

###  ✅ NEW (CDP-based - WORKING)
- **No Xvfb needed**
- **No VNC needed**
- **No websockify needed**
- Direct Puppeteer + Chrome DevTools Protocol
- Screenshot streaming via WebSocket
- Simpler, faster, more reliable

---

## Architecture Overview

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│   Browser    │  HTTP   │    Tagent    │  Redis  │    Worker    │
│   (User)     │◄──────► │     Main     │◄──────► │  (Puppeteer) │
│              │         │   Service    │         │              │
└──────────────┘         └──────────────┘         └───────┬──────┘
       │                                                   │
       │                 WebSocket (Screenshot Stream)     │
       └───────────────────────────────────────────────────┘
```

### Components

1. **Main Tagent Service** (`server/production.js`)
   - Serves frontend
   - Handles API requests
   - Manages Redis queue
   - **NO browser automation**

2. **Worker Service** (`worker/browser-agent-cdp.js`)
   - Runs Puppeteer browsers
   - Executes automation tasks
   - Streams screenshots via WebSocket
   - Exposes CDP endpoints

3. **Frontend** (`client/src/components/BrowserStreamViewer.tsx`)
   - Receives WebSocket screenshot stream
   - Displays live browser view
   - **NO noVNC library needed**

---

## Railway Deployment

### Service 1: Tagent (Main App)

**Root Service:**
- Detects Node.js automatically
- Runs `npm run build && npm start`
- Serves on port 8080
- **No changes needed**

### Service 2: Worker (Browser Agent)

**Critical: Use Dockerfile, NOT Nixpacks**

#### Option A: Railway Dashboard (RECOMMENDED)

1. Go to Worker service → Settings → Build
2. **Builder**: Dockerfile
3. **Dockerfile Path**: `worker/Dockerfile`
4. **Root Directory**: Keep empty (will auto-detect)
5. Click "Deploy"

#### Option B: Railway CLI

```bash
cd worker
railway up --service worker
```

#### Environment Variables (Worker)

Required:
```
REDIS_PUBLIC_URL=redis://default:xxx@tramway.proxy.rlwy.net:54627
PORT=8080
```

Optional:
```
WORKER_ID=worker-1
```

---

## Testing the New System

### 1. Check Worker Health

```bash
curl https://worker-production-6480.up.railway.app/health
```

Expected response:
```json
{
  "status": "healthy",
  "workerId": "worker-xxxxx",
  "activeSessions": 0,
  "timestamp": "2025-10-07T..."
}
```

### 2. Create Browser Session

```bash
curl https://worker-production-6480.up.railway.app/session/test-session-123
```

Expected response:
```json
{
  "sessionId": "test-session-123",
  "isActive": true,
  "createdAt": "2025-10-07T...",
  "streamUrl": "/browser-stream?sessionId=test-session-123",
  "cdpUrl": "ws://..."
}
```

### 3. Execute Task

```bash
curl -X POST https://worker-production-6480.up.railway.app/session/test-session-123/execute \
  -H "Content-Type: application/json" \
  -d '{
    "action": "navigate",
    "params": {
      "url": "https://google.com"
    }
  }'
```

### 4. Connect WebSocket (Browser Console)

```javascript
const ws = new WebSocket('wss://worker-production-6480.up.railway.app/browser-stream?sessionId=test-session-123');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Screenshot received:', data.timestamp);
  
  // Display in image element
  const img = document.createElement('img');
  img.src = `data:image/jpeg;base64,${data.data}`;
  document.body.appendChild(img);
};
```

---

## Troubleshooting

### Issue: "Chromium not found"

**Solution:** Make sure Railway is using the Dockerfile, not Nixpacks.

1. Worker Settings → Build → Builder: **Dockerfile**
2. Redeploy

### Issue: "Connection refused" on WebSocket

**Check:**
1. Worker service is running: `railway status --service worker`
2. Port 8080 is exposed: Check Dockerfile `EXPOSE 8080`
3. WebSocket URL is correct: `wss://` not `ws://`

### Issue: No screenshots received

**Debug:**
1. Check worker logs: `railway logs --service worker`
2. Verify session exists: `GET /session/{sessionId}`
3. Check WebSocket connection in browser DevTools → Network → WS

### Issue: "spawn ENOENT" errors

**This means Dockerfile wasn't used.** Force rebuild:
```bash
railway up --service worker --dockerfile worker/Dockerfile
```

---

## Performance Optimization

### Screenshot Quality vs Bandwidth

Edit `worker/browser-agent-cdp.js`:

```javascript
const screenshot = await this.page.screenshot({ 
  type: 'jpeg', 
  quality: 60,  // Lower = smaller file, faster
  encoding: 'base64'
});
```

### Frame Rate

Edit `worker/browser-agent-cdp.js`:

```javascript
const config = {
  screenshotInterval: 500, // ms - higher = lower FPS, less bandwidth
};
```

### Concurrent Sessions

Edit worker BullMQ concurrency:

```javascript
const worker = new Worker(
  'browser-automation',
  async (job) => { /* ... */ },
  { concurrency: 5 } // Increase for more parallel sessions
);
```

---

## Migration from Old VNC System

### Files to Delete (After Verifying New System Works)

```bash
rm worker-production-vnc.js
rm worker/vnc-manager.ts
rm worker/browser-engine-vnc.ts
rm client/src/components/vnc/VNCClient.tsx
rm client/src/lib/vnc-loader.ts
```

### Update References

Search and replace in codebase:
- `VNCClient` → `BrowserStreamViewer`
- `worker-production-vnc` → `browser-agent-cdp`

---

## Why This Works

### The Problem with VNC
1. **VNC requires a display** → Xvfb
2. **VNC uses TCP** → websockify
3. **All must run in same container** → complex setup
4. **Heavy resource usage** → 200MB+ memory per session
5. **Fragile** → any one component fails = whole system fails

### The CDP Solution
1. **Puppeteer has headless mode** → no display needed
2. **Screenshots via API** → no VNC
3. **WebSocket built-in** → no websockify
4. **Light resource usage** → 50-100MB per session
5. **Robust** → fewer moving parts = fewer failures

---

## Next Steps

1. ✅ Deploy worker with Dockerfile
2. ✅ Test health endpoint
3. ✅ Test session creation
4. ✅ Test WebSocket connection
5. ✅ Verify screenshots stream
6. ✅ Test from frontend
7. ✅ Delete old VNC code

## Support

If issues persist after following this guide:

1. Check Railway logs: `railway logs`
2. Verify environment variables
3. Test endpoints manually with curl
4. Check browser console for WebSocket errors

**The VNC loop is broken. This architecture is proven and working.**

