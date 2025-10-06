# 🚀 DEPLOY FULL WORKER WITH VNC LIVE STREAMING

This guide sets up the REAL browser automation worker with VNC live streaming.

---

## **What This Worker Does**

✅ **Receives tasks** from Redis/BullMQ queue  
✅ **Launches browsers** with VNC display streaming  
✅ **Executes automation** (search, navigate, click, etc.)  
✅ **Streams live view** of browser to users via VNC  
✅ **Keeps browsers alive** for 5 minutes for live viewing  

---

## **Step 1: Add Redis Service on Railway**

### **Why Redis?**
- BullMQ queue needs Redis for task distribution
- Main app pushes tasks → Redis queue → Worker pulls tasks
- Redis on Railway: **$10/month** (required for production)

### **How to Add:**

1. **In Railway Dashboard:**
   - Click **"+ New"**
   - Select **"Database"** → **"Redis"**
   - Name it: `redis`
   - Railway will auto-provision Redis

2. **Copy Redis URL:**
   - Go to `redis` service → **Variables** tab
   - Copy the `REDIS_URL` (starts with `redis://`)

---

## **Step 2: Create Worker Service**

1. **In Railway Dashboard:**
   - Click **"+ New"**
   - Select **"GitHub Repo"**
   - Choose your repo: `Hasbicom1/Tagent`
   - Name it: `worker`

2. **Configure Worker Service:**

   **Settings → Root Directory:**
   ```
   (leave empty - builds from repo root)
   ```

   **Settings → Railway JSON Path:**
   ```
   railway-worker.json
   ```

   **Settings → Environment Variables:**
   ```
   REDIS_URL=<paste the Redis URL from Step 1>
   NODE_ENV=production
   ```

3. **Deploy:**
   - Railway will auto-deploy using `railway-worker.json` config
   - Wait for build to complete (~5 minutes)

---

## **Step 3: Update Main App (Tagent)**

### **Add Redis URL to Tagent:**

1. **Go to Tagent service → Variables**
2. **Add these variables:**
   ```
   REDIS_URL=<same Redis URL from Step 1>
   WORKER_INTERNAL_URL=http://worker.railway.internal:8080
   ```

### **Why?**
- `REDIS_URL`: Main app needs to push tasks to Redis queue
- `WORKER_INTERNAL_URL`: Fallback for direct HTTP task submission

---

## **Step 4: Update Main App Code to Use Redis Queue**

Now we need to modify `server/production.js` to push tasks to Redis instead of HTTP:

**File: `server/production.js`**

Find this section (around line 750):
```javascript
// REAL BROWSER AUTOMATION: Queue task to worker service
let taskId = null;

if (hasBrowserCommand) {
  console.log(`🎯 Browser task detected, queueing to worker: "${userText}"`);
  
  // Send task to worker service via HTTP (no Redis needed)
  const workerUrl = process.env.WORKER_INTERNAL_URL || 'http://worker.railway.internal:3001';
  
  try {
    const workerResponse = await fetch(`${workerUrl}/task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instruction: userText,
        sessionId: req.params.sessionId,
        agentId: req.params.sessionId
      }),
      signal: AbortSignal.timeout(5000)
    });
    // ... rest of code
```

**Replace with Redis queue:**
```javascript
// REAL BROWSER AUTOMATION: Queue task via Redis/BullMQ
let taskId = null;

if (hasBrowserCommand) {
  console.log(`🎯 Browser task detected, queueing to Redis: "${userText}"`);
  
  try {
    // Import queue at top of file:
    // import { addTask } from './queue.js';
    
    // Queue task to Redis (worker will pick it up)
    const task = await addTask({
      type: 'browser-automation',
      payload: {
        instruction: userText,
        sessionId: req.params.sessionId,
        agentId: req.params.sessionId
      },
      priority: 'high'
    });
    
    taskId = task.id;
    console.log(`✅ Task queued to Redis: ${taskId}`);
    
  } catch (error) {
    console.warn(`⚠️  Failed to queue task to Redis: ${error.message}`);
    // Continue without task - chat still works
  }
}
```

---

## **Step 5: Verify Everything Works**

### **Check Logs:**

1. **Redis service:**
   - Should show: `Ready to accept connections`

2. **Worker service:**
   - Should show:
     ```
     ✅ BullMQ worker connected and listening for tasks
     ✅ Worker HTTP API listening on port 8080
     🎯 Worker ready with VNC live streaming support
     ```

3. **Tagent service:**
   - Should show:
     ```
     🔌 Redis connected successfully
     ✅ PRODUCTION: Server started successfully
     ```

### **Test Flow:**

1. **Pay $1 → Get session link**
2. **Open chat interface**
3. **Type:** `search for iphone 15`
4. **Expected:**
   - ✅ AI responds: "I'll search for that"
   - ✅ `hasExecutableTask: true` in response
   - ✅ `taskId` returned
   - ✅ "Task Started" toast appears
   - ✅ Live browser view shows Google search
   - ✅ Browser executes search in real-time

---

## **Architecture**

```
User Chat
    ↓
Main App (Tagent)
    ↓
Redis Queue (BullMQ)
    ↓
Worker Service
    ↓
Browser + VNC Server
    ↓
WebSocket Stream → User's Live View
```

---

## **Cost Breakdown**

| Service | Cost/Month | Required? |
|---------|-----------|-----------|
| Tagent (Main App) | $5 | ✅ Yes |
| Worker | $5 | ✅ Yes |
| Redis | $10 | ✅ Yes |
| **TOTAL** | **$20/month** | |

**Can we do $5/month?**
- Not with Redis + separate worker
- Redis alone is $10/month on Railway
- But you get: ✅ Real queue, ✅ VNC streaming, ✅ Scalable

---

## **Troubleshooting**

### **Worker Not Starting:**
- Check logs for missing system packages (xvfb, x11vnc)
- Ensure `nixpacks-worker.toml` is being used
- Redeploy worker

### **No VNC Display:**
- Xvfb failed to start → Check logs for display errors
- x11vnc failed → Check logs for port conflicts
- Browser not visible → Ensure `headless: false` in worker

### **Tasks Not Processing:**
- Check Redis connection in both Tagent and Worker
- Verify `REDIS_URL` is identical in both services
- Check worker logs for `📥 Received job` messages

### **Live View Not Showing:**
- VNC WebSocket URL might be wrong
- Check frontend is connecting to correct WebSocket endpoint
- Verify VNC session exists: `GET /vnc/:sessionId` on worker

---

## **Next Steps**

After successful deployment:

1. **Test full flow** (payment → chat → automation → live view)
2. **Monitor costs** (Redis is the big one)
3. **Scale if needed** (increase worker replicas for more concurrency)

---

**Ready to deploy? Let's do this! 🚀**

