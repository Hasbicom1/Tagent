# 🚀 COMPLETE RAILWAY CONFIGURATION GUIDE

## 📊 CURRENT STATUS ANALYSIS (Based on Your Logs)

### ✅ **What's Working:**
1. **Main App (Tagent)** ✅
   - Redis: Connected
   - Database: Connected
   - AI (Groq): Working (responded in 278ms)
   - Server: Running on port 8080
   - Session created successfully

2. **Worker Service** 🟡 Partially Working
   - Redis: Connected
   - BullMQ: Connected
   - HTTP API: Running on port 8080
   - **VNC: BROKEN** ❌

### ❌ **The Critical Issue:**

```
❌ Xvfb failed to start: Error: spawn Xvfb ENOENT
```

**Translation:** Xvfb binary not found = Not installed = Railway using wrong build system

---

## 🔧 COMPLETE FIX: 3 Services Configuration

You have **3 services** in Railway:
1. **Tagent** (main app)
2. **worker** (browser automation)
3. **postgres** (database)
4. **redis** (queue)
5. **ollama-ai** (AI model)

### **Service 1: Tagent (Main App)**

**Current:** ✅ Working correctly

**Railway Configuration:**
```
Root Directory: (empty - uses root)
Builder: Nixpacks (Node.js)
Start Command: node server/production.js
Build Command: npm run build
```

**Environment Variables Needed:**
```bash
NODE_ENV=production
PORT=8080
DATABASE_URL=(auto from postgres service)
REDIS_URL=(auto from redis service)
REDIS_PRIVATE_URL=(auto from redis service)
REDIS_PUBLIC_URL=(auto from redis service)
GROQ_API_KEY=(your key)
OPENAI_API_KEY=(your key)
OLLAMA_INTERNAL_URL=http://ollama-ai.railway.internal:11434
OLLAMA_MODEL=tinyllama:latest
WORKER_INTERNAL_URL=http://worker.railway.internal:8080
WORKER_PUBLIC_URL=https://worker-production-6480.up.railway.app
SESSION_SECRET=(your secret)
STRIPE_SECRET_KEY=(your key)
STRIPE_WEBHOOK_SECRET=(your secret)
VITE_STRIPE_PUBLIC_KEY=(your key)
FRONTEND_URL=https://www.onedollaragent.ai
DOMAIN=onedollaragent.ai
CORS_ORIGINS=https://www.onedollaragent.ai,https://onedollaragent.ai
```

**Networking:**
- ✅ Public domain: `www.onedollaragent.ai`
- ✅ Port 8080 exposed

---

### **Service 2: worker (NEEDS FIX)**

**Current:** ❌ Using Nixpacks (wrong)
**Should Be:** ✅ Using Dockerfile

#### **STEP-BY-STEP FIX:**

1. **Go to Railway Dashboard**
2. **Click worker service**
3. **Go to Settings tab**

4. **Configure Source:**
   ```
   Source Repo: Hasbiconni/Tagent
   Branch: production (or main)
   Root Directory: worker    ← ADD THIS!
   ```

5. **Configure Build:**
   ```
   Builder: Dockerfile       ← CHANGE TO THIS!
   Dockerfile Path: Dockerfile
   ```

6. **Configure Deploy:**
   ```
   Start Command: (leave empty, uses Dockerfile CMD)
   Healthcheck Path: /health
   Healthcheck Timeout: 300
   Restart Policy: ON_FAILURE
   ```

7. **Environment Variables:**
   ```bash
   NODE_ENV=production
   PORT=8080
   REDIS_URL=(auto from redis service)
   REDIS_PRIVATE_URL=(auto from redis service)
   REDIS_PUBLIC_URL=(auto from redis service)
   DISPLAY=:99
   VNC_RESOLUTION=1920x1080x24
   ```

8. **Networking:**
   ```
   Public Domain: worker-production-6480.up.railway.app
   Exposed Ports:
   - 8080 (HTTP API)
   - 6080 (noVNC web interface) ← ADD THIS IF NOT PRESENT
   - 5900 (VNC direct)            ← ADD THIS IF NOT PRESENT
   ```

9. **DEPLOY:**
   - Click **Deployments** tab
   - Click **"Redeploy"** on latest deployment

---

### **Service 3: postgres**

**Current:** ✅ Working correctly

No changes needed.

---

### **Service 4: redis**

**Current:** ✅ Working correctly

**Important:** Make sure these are exposed:
```
Internal URL: redis://default:password@redis.railway.internal:6379
Public URL: redis://default:password@tramway.proxy.rlwy.net:54627
```

---

### **Service 5: ollama-ai**

**Current:** ✅ Working correctly

No changes needed.

---

## 🎯 EXPECTED BUILD OUTPUT (After Fix)

When you redeploy the **worker**, you should see in build logs:

```bash
#1 [internal] load build definition from Dockerfile
#2 [internal] load .dockerignore
#3 [1/8] FROM python:3.11-slim-bookworm
#4 [2/8] RUN apt-get update && apt-get install -y wget netcat-traditional...
✅ Installing xvfb
✅ Installing x11vnc
✅ Installing tigervnc-tools
✅ Installing supervisor
#5 [3/8] RUN git clone https://github.com/novnc/noVNC.git /opt/novnc
✅ Installing noVNC
#6 [4/8] WORKDIR /app
#7 [5/8] COPY requirements.txt .
#8 [6/8] RUN pip install --no-cache-dir -r requirements.txt
#9 [7/8] RUN playwright install chromium
✅ Installing Chromium
#10 [8/8] COPY . .
#11 exporting to image
✅ Build complete
```

---

## ✅ VERIFICATION STEPS

### **1. Check Worker Build Logs**
```bash
# Should see:
✅ Building with Dockerfile
✅ Installing system packages (xvfb, x11vnc, etc.)
```

### **2. Check Worker Runtime Logs**
```bash
# Should see:
✅ Xvfb started on display :99
✅ x11vnc listening on port 5900
✅ noVNC proxy started on port 6080
✅ FastAPI worker listening on port 8080
✅ BullMQ worker connected
```

### **3. Test Health Endpoint**
```bash
curl https://worker-production-6480.up.railway.app/health
# Should return:
{
  "status": "healthy",
  "timestamp": "...",
  "services": {
    "redis": "connected",
    "vnc": "running",
    "browser": "ready"
  }
}
```

### **4. Test VNC Endpoint**
Open in browser:
```
https://worker-production-6480.up.railway.app:6080/vnc.html?autoconnect=true
```
Should show noVNC viewer (may be black screen until browser launches)

### **5. Test Full Flow**
1. Go to: `https://www.onedollaragent.ai/live/agent/YOUR_SESSION_ID`
2. Type: "go to google"
3. Send
4. **Expected:** See live browser in the viewer area

---

## 🚨 CRITICAL RAILWAY UI STEPS (Visual Guide)

### **Screenshot 1: Settings > Source**
```
┌───────────────────────────────────────────┐
│ Source                                    │
├───────────────────────────────────────────┤
│ Source Repo                               │
│ ├─ Hasbiconni/Tagent              [Edit] │
│                                           │
│ Branch connected to production            │
│ ├─ main                         [Edit]   │
│                                           │
│ Root Directory                            │
│ ├─ worker                       [Edit]   │ ← MUST SET THIS!
│ └─ (used for build and deploy steps)     │
└───────────────────────────────────────────┘
```

### **Screenshot 2: Settings > Build**
```
┌───────────────────────────────────────────┐
│ Build                                     │
├───────────────────────────────────────────┤
│ Builder                                   │
│ ├─ Dockerfile                  [Change]  │ ← MUST BE DOCKERFILE
│                                           │
│ Custom Build Command                      │
│ ├─ (empty)                                │
│                                           │
│ Watch Paths                               │
│ ├─ (empty)                                │
└───────────────────────────────────────────┘
```

### **Screenshot 3: Settings > Networking**
```
┌───────────────────────────────────────────┐
│ Public Networking                         │
├───────────────────────────────────────────┤
│ worker-production-6480.up.railway.app     │
│ ├─ Port 8080 - Metal Edge - Setup       │ ← Already have
│ └─ [+ Custom Domain] [+ TCP Proxy]       │
│                                           │
│ Generate Domain or [+ Add Port]          │ ← Click this
│ Add ports: 6080, 5900                    │ ← Add these
└───────────────────────────────────────────┘
```

---

## 📝 COMMIT AND DEPLOY

I've created `worker/railway.toml` which Railway should auto-detect. Let's commit:

```powershell
git add worker/railway.toml RAILWAY-WORKER-FIX.md COMPLETE-RAILWAY-CONFIGURATION-GUIDE.md
git commit -m "fix: configure Railway to use Dockerfile for worker with VNC support"
git push origin main
```

After pushing:
1. Railway will auto-deploy
2. Worker should rebuild with Dockerfile
3. VNC should work

---

## 🆘 IF RAILWAY STILL USES NIXPACKS

If after setting Root Directory Railway still uses Nixpacks:

1. Delete `package.json` from `worker/` directory (if it exists)
2. Or manually force rebuild:
   - Settings → Build → Builder → Select "Dockerfile"
   - Deployments → Redeploy

---

## 📞 NEXT STEPS

1. **Set Root Directory to `worker` in Railway UI**
2. **Verify Builder is "Dockerfile"**
3. **Add ports 6080 and 5900 to Networking**
4. **Redeploy**
5. **Check logs for VNC startup**
6. **Test the application**

Let me know when you've updated the Railway settings and I'll guide you through verification! 🚀

