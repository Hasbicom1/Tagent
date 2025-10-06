# Deploy Browser Automation Worker to Railway ($5/month)

## Architecture

```
Railway Project (Single $5/month plan):
├── Tagent (existing) - Main web app
│   └── Port: 8080
└── Worker (new) - Browser automation service
    └── Port: 3001
```

**Communication**: HTTP-based (no Redis needed for MVP)

---

## Step 1: Deploy Worker Service

### In Railway Dashboard:

1. **Open your existing project** (where Tagent is deployed)

2. **Click "+ New Service"**

3. **Select "GitHub Repo"**

4. **Choose your repository**: `Hasbicom1/Tagent`

5. **Configure the service**:
   - **Service Name**: `worker`
   - **Root Directory**: Leave empty (use repo root)
   - **Branch**: `main`

6. **Click "Settings" tab** for the new `worker` service:
   - **Builder**: Nixpacks (auto-detected)
   - **Start Command**: `node worker-production.js`
   - **Healthcheck Path**: `/health`
   - **Healthcheck Timeout**: `300`
   - **Port**: Railway will auto-assign (default 3001 works)

7. **Enable Private Networking**:
   - In Settings → Networking
   - Turn ON "Private Networking"
   - Note the internal DNS: `worker.railway.internal`

8. **Deploy**: Click "Deploy"

---

## Step 2: Update Main App (Tagent) Environment Variables

### In Railway Dashboard → Tagent service → Variables:

Add this new variable:

```
WORKER_INTERNAL_URL=http://worker.railway.internal:3001
```

**Do NOT modify** existing variables like:
- `GROQ_API_KEY`
- `DATABASE_URL`
- `STRIPE_SECRET_KEY`

---

## Step 3: Redeploy Main App

After adding the `WORKER_INTERNAL_URL` variable:

1. Go to Tagent service → Deployments
2. Click "Deploy Latest" (or wait for auto-deploy)

---

## Step 4: Verify Everything Works

### Check Worker is Running:

1. Go to `worker` service → Logs
2. You should see:
   ```
   🤖 WORKER: Starting browser automation service...
   ✅ WORKER: Browser automation service listening on port 3001
   ✅ WORKER: Health check: http://localhost:3001/health
   🎯 WORKER: Ready to execute browser automation tasks
   ```

### Check Main App Can Reach Worker:

1. Go to `Tagent` service → Logs
2. Send a chat message like: `"search for cheap flights"`
3. You should see:
   ```
   🔍 Browser task detection: true (keywords: search)
   🎯 Browser task detected, queueing to worker: "search for cheap flights"
   ✅ Task queued to worker successfully: task_1234567890_xxx
   ```

### Test the Full Flow:

1. **Open your web app**: `https://tagent-production.up.railway.app`
2. **Pay $1** and get a session
3. **Open the chat**
4. **Type**: `"search for iPhone 15"`
5. **Expected behavior**:
   - AI responds with chat message ✅
   - Task is queued to worker ✅
   - Worker launches browser ✅
   - Worker executes search ✅
   - Screenshot is captured ✅

---

## How It Works

### User Chat Flow:

```
User: "search for iPhone 15"
  ↓
Tagent (main app):
  1. Groq AI responds: "I'll search for iPhone 15"
  2. Detects browser keyword: "search"
  3. Sends HTTP POST to worker:
     POST http://worker.railway.internal:3001/task
     { instruction: "search for iPhone 15", sessionId: "xxx" }
  ↓
Worker Service:
  1. Receives task
  2. Launches Chromium browser
  3. Navigates to google.com
  4. Types query and presses Enter
  5. Takes screenshot
  6. Returns result
  ↓
User sees:
  - Chat message from AI
  - (Later) Screenshot/result
```

---

## Cost Breakdown

**Railway Hobby Plan ($5/month)**:
- ✅ Tagent service (main app)
- ✅ Worker service (browser automation)
- ✅ Private networking (inter-service communication)
- ✅ Automatic HTTPS
- ✅ $5 of usage included

**Total**: **$5/month** (no additional costs)

---

## Troubleshooting

### Worker Not Starting:

**Check logs for**:
```
❌ WORKER: Uncaught exception: ...
```

**Common fixes**:
- Ensure Chromium dependencies are installed (Nixpacks should handle this)
- Check Railway has enough resources (restart services if needed)

### Main App Can't Reach Worker:

**Check logs for**:
```
⚠️  Failed to reach worker service: fetch failed
   Worker might not be running or URL incorrect
```

**Fixes**:
1. Verify `WORKER_INTERNAL_URL` is set correctly
2. Verify Private Networking is ON for both services
3. Verify worker service name is exactly `worker` (or update URL)

### Task Never Completes:

**Check worker logs for**:
```
🚀 WORKER: Starting task task_xxx
...
(timeout or error)
```

**Common issues**:
- Browser launch failure (memory limit)
- Network timeout (increase timeout in code)
- Invalid instruction (check keyword detection)

---

## Scaling

### If You Need More Power:

**Hobby Plan ($5/month)**: Good for demo, low traffic
- 2 services (Tagent + Worker)
- Shared resources

**Pro Plan ($20/month)**: Production-ready
- Same 2 services
- More CPU/memory
- Better performance for concurrent users

**Add Redis (optional, $10/month)**:
- For persistent task queue
- For WebSocket session management
- Not required for MVP

---

## Next Steps After This Works

1. **Add VNC streaming** (so users see browser live)
2. **Add task status polling** (show progress bar)
3. **Add screenshot display** (show result in chat)
4. **Add more automation** (clicking, form filling, etc.)

---

## Summary

**What you're deploying**:
- ✅ Browser automation worker (Playwright + Chromium)
- ✅ HTTP-based task queue (no Redis needed)
- ✅ Private networking (services talk internally)
- ✅ Real browser automation (not simulation)

**Cost**: **$5/month** (Railway Hobby plan)

**Deploy now**: Follow steps 1-4 above.

