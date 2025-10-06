# ✅ QUICK DEPLOYMENT CHECKLIST

**Goal:** Get live browser automation working with VNC streaming

---

## **Phase 1: Add Redis (5 minutes)**

### **Railway Dashboard:**
1. Click **"+ New"** → **"Database"** → **"Redis"**
2. Name it: `redis`
3. Wait for it to deploy (green checkmark)
4. Go to **Variables** tab
5. Copy the `REDIS_URL` value

✅ **Done when:** Redis service is green and you have the `REDIS_URL` copied

---

## **Phase 2: Create Worker Service (10 minutes)**

### **Railway Dashboard:**
1. Click **"+ New"** → **"GitHub Repo"**
2. Choose: `Hasbicom1/Tagent`
3. Name it: `worker`
4. **Settings → Railway JSON Path:**
   ```
   railway-worker.json
   ```
5. **Settings → Variables → Add:**
   ```
   REDIS_URL=<paste Redis URL from Phase 1>
   NODE_ENV=production
   ```
6. **Settings → Builder:** Should auto-detect as `NIXPACKS`
7. Click **"Deploy"**
8. Wait ~5-7 minutes for build (installing xvfb, x11vnc, Playwright, etc.)

✅ **Done when:** 
- Worker service shows green checkmark
- Logs show: `✅ Worker HTTP API listening on port 8080`
- Logs show: `✅ BullMQ worker connected and listening for tasks`

---

## **Phase 3: Update Main App (Tagent) (2 minutes)**

### **Railway Dashboard → Tagent Service:**
1. Go to **Variables** tab
2. **Add these new variables:**
   ```
   REDIS_URL=<same Redis URL from Phase 1>
   WORKER_INTERNAL_URL=http://worker.railway.internal:8080
   ```
3. Click **"Save"** (Railway will auto-redeploy)
4. Wait ~2 minutes for redeploy

✅ **Done when:** 
- Tagent service shows green checkmark
- Logs show: `✅ PRODUCTION: Browser automation queue initialized`

---

## **Phase 4: Verify Everything (5 minutes)**

### **Check Logs:**

#### **Redis Service:**
```
✅ Ready to accept connections
```

#### **Worker Service:**
```
✅ BullMQ worker connected and listening for tasks
✅ Worker HTTP API listening on port 8080
🎯 Worker ready with VNC live streaming support
```

#### **Tagent Service:**
```
✅ PRODUCTION: Browser automation queue initialized
✅ PRODUCTION: Server started successfully
```

---

## **Phase 5: Test Live Automation (5 minutes)**

### **End-to-End Test:**

1. **Go to:** `https://www.onedollaragent.ai`
2. **Pay $1** → Get session link
3. **Open session** → You should see split-screen interface:
   - Left: Chat panel
   - Right: Live browser view (placeholder until task starts)
4. **In chat, type:** `search for iphone 15`
5. **Expected behavior:**
   - ✅ AI responds: "I'll search for that"
   - ✅ "Task Started" toast appears
   - ✅ Right panel shows loading spinner
   - ✅ Browser window appears in right panel
   - ✅ Google search executes in real-time
   - ✅ You see the live browser as it searches

6. **Check Worker Logs (Railway):**
   ```
   📥 Received job XXX from queue
   🖥️  Starting Xvfb on display :1...
   ✅ Xvfb started on display :1
   📺 Starting VNC server on port 5901...
   ✅ VNC server listening on port 5901
   🌐 Launching browser on display :1...
   🔍 Searching for: "iphone 15"
   ✅ Task task_XXX completed successfully
   ```

---

## **Troubleshooting**

### **❌ Worker logs show "Queue not initialized":**
- **Fix:** Check `REDIS_URL` is set in Worker variables
- **Redeploy:** Worker service

### **❌ Tagent logs show "Redis queue not available":**
- **Fix:** Check `REDIS_URL` is set in Tagent variables
- **Redeploy:** Tagent service

### **❌ Worker fails to start (build errors):**
- **Fix:** Check `nixpacks-worker.toml` is present in repo
- **Fix:** Verify `railway-worker.json` points to it
- **Redeploy:** Worker service (may take 5-10 mins)

### **❌ Xvfb fails to start:**
- **Check:** Worker logs for `apt` package installation errors
- **Fix:** Ensure `nixpacks-worker.toml` has `xvfb` in `apt_packages`
- **Redeploy:** Worker service

### **❌ Live browser view shows nothing:**
- **Check:** VNC session was created (Worker logs)
- **Check:** Frontend is connecting to correct WebSocket URL
- **Note:** This is the next feature to implement (VNC WebSocket proxy)

---

## **Current Status After Deployment**

✅ **What Works:**
- Chat interface
- AI responses (Groq)
- Browser automation (search, navigate, screenshot)
- Task queueing via Redis
- Worker executes tasks in background

⚠️ **What's Next:**
- VNC WebSocket streaming to frontend (live view)
- Frontend needs to connect to VNC session
- May require VNC proxy in main app

---

## **Cost Summary**

| Service | Cost | Status |
|---------|------|--------|
| Tagent | $5/mo | Running |
| Worker | $5/mo | Running |
| Redis | $10/mo | Running |
| **Total** | **$20/mo** | |

---

## **Success Criteria**

You'll know it's working when:
1. ✅ All 3 services (Tagent, Worker, Redis) are green
2. ✅ Chat sends message → AI responds
3. ✅ Browser task detected → Task queued to Redis
4. ✅ Worker picks up task → Executes in browser
5. ✅ Screenshot captured and returned
6. ⏳ Live view streaming (next step)

---

**Ready? Start with Phase 1! 🚀**

