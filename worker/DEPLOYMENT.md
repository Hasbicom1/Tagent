# Worker Deployment Guide - Python + VNC

## Architecture

**Stack:** Python 3.11 + FastAPI + Playwright + Xvfb + x11vnc + noVNC

**Ports:**
- `8080` - FastAPI worker API (health checks, task endpoints)
- `6080` - noVNC web client (live browser view)
- `5901` - x11vnc server (direct VNC access)
- `9222` - Chrome debugging port (optional)

**Processes (managed by supervisord):**
1. **Xvfb** - Virtual display server (`:99`)
2. **x11vnc** - VNC server streaming the virtual display
3. **noVNC** - WebSocket proxy + web VNC client
4. **worker** - Python FastAPI app processing browser tasks

## Railway Deployment

### 1. Environment Variables

Set these in Railway worker service:

```bash
# Redis (required)
REDIS_PUBLIC_URL=redis://default:xxx@tramway.proxy.rlwy.net:54627

# Display settings
DISPLAY=:99
RESOLUTION=1920x1080x24
RESOLUTION_WIDTH=1920
RESOLUTION_HEIGHT=1080

# VNC password
VNC_PASSWORD=yourvncpassword

# Port (Railway will set this automatically)
PORT=8080
```

### 2. Deploy

Railway will automatically detect the `Dockerfile` in the `worker/` directory.

```bash
# Push to trigger deployment
git add worker/
git commit -m "feat: Python worker with VNC live browser view"
git push
```

### 3. Verify Deployment

Check Railway logs for these messages:

```
✅ Xvfb started on :99
✅ x11vnc started on port 5901
✅ noVNC proxy started on port 6080
✅ Worker API started on port 8080
```

Health check:
```bash
curl https://worker-production-6480.up.railway.app/health
```

Expected response:
```json
{
  "status": "healthy",
  "browser": "running",
  "redis": "connected",
  "display": ":99"
}
```

## Testing

### Test noVNC Access

Open in browser:
```
https://worker-production-6480.up.railway.app:6080/vnc.html
```

You should see:
- noVNC connection prompt
- Enter VNC password
- Live Chromium browser on virtual display

### Test Task Submission

```bash
curl -X POST https://worker-production-6480.up.railway.app/task \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test_session_123",
    "actions": [
      {"navigate": "https://www.google.com"},
      {"wait": {"seconds": 2}},
      {"type": {"selector": "textarea[name=q]", "text": "AI agents"}},
      {"click": {"selector": "input[value=\"Google Search\"]"}}
    ]
  }'
```

Response:
```json
{
  "success": true,
  "jobId": "abc123",
  "sessionId": "test_session_123",
  "message": "Task enqueued successfully"
}
```

Watch the noVNC view to see the browser execute these actions in real-time!

## Architecture Flow

```
User sends task via /task endpoint
         ↓
FastAPI enqueues to Redis (RQ)
         ↓
RQ worker picks up task
         ↓
Playwright executes on Xvfb display :99
         ↓
x11vnc streams display to port 5901
         ↓
noVNC proxies to WebSocket (port 6080)
         ↓
Frontend iframe shows live browser at :6080/vnc.html
```

## Troubleshooting

**Worker not starting:**
- Check Railway logs for errors
- Verify `REDIS_PUBLIC_URL` is set
- Ensure Dockerfile is in `worker/` directory

**noVNC not accessible:**
- Verify port 6080 is exposed in Railway settings
- Check supervisord logs: `[program:novnc]`
- Test direct VNC: `vncviewer worker-url:5901`

**Browser not visible in VNC:**
- Check Xvfb is running: logs should show `Xvfb :99 -screen 0 1920x1080x24`
- Verify `DISPLAY=:99` is set in environment
- Check Playwright logs for display errors

**Tasks not executing:**
- Verify Redis connection: check `/health` endpoint
- Check RQ worker logs
- Test Redis connection manually

## Next Steps

1. Deploy worker to Railway
2. Update frontend `BrowserStreamViewer` with correct worker URL
3. Test live browser view
4. Submit a task and watch it execute in real-time!

## Cost

- **Railway**: Free tier (worker + Redis)
- **VNC**: Free (open source)
- **Browser**: Free (Chromium via Playwright)
- **Total**: $0 🎉

