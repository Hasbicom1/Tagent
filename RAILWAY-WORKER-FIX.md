# 🔧 RAILWAY WORKER VNC FIX

## ❌ **Current Problem**
```
❌ Xvfb failed to start: Error: spawn Xvfb ENOENT
```

**Root Cause:** Railway is using Nixpacks (Node.js builder) instead of your Docker configuration that has VNC support.

---

## ✅ **THE FIX: Configure Railway to Use Docker**

### **Step 1: Set Root Directory for Worker Service**

1. Go to Railway Dashboard
2. Click on **worker** service
3. Go to **Settings** tab
4. Scroll to **Source** section
5. Find **"Add Root Directory"** button (you saw it in your screenshot)
6. Click it and set: `worker`
7. **Save changes**

### **Step 2: Verify Build Configuration**

1. Still in **Settings** → scroll to **Build** section
2. You should see **"Builder: Dockerfile"** (not Nixpacks)
3. If it says Nixpacks, manually change it:
   - Click **"Builder"**
   - Select **"Dockerfile"**
   - Save

### **Step 3: Set Environment Variables**

Make sure these are set for the **worker** service:

```bash
# In Railway worker service → Variables tab:
PORT=8080
NODE_ENV=production
REDIS_URL=(should be already set from Redis service)
DISPLAY=:99
```

### **Step 4: Redeploy**

1. Go to **Deployments** tab
2. Click **"Redeploy"** on the latest deployment
3. Watch the build logs - you should see:
   ```
   ✅ Building with Dockerfile
   ✅ Installing Xvfb
   ✅ Installing x11vnc
   ✅ Installing noVNC
   ```

---

## 📊 **Verification Checklist**

After redeployment, check worker logs for:

✅ **Should See:**
```
✅ Xvfb started on display :99
✅ x11vnc listening on port 5900
✅ noVNC proxy started on port 6080
✅ BullMQ worker connected
```

❌ **Should NOT See:**
```
❌ spawn Xvfb ENOENT
❌ Nixpacks building
```

---

## 🎯 **Quick Visual Guide**

### Your Railway Worker Settings Should Look Like:

```
┌─────────────────────────────────────┐
│ worker Settings                     │
├─────────────────────────────────────┤
│                                     │
│ Source                              │
│ ├─ Source Repo: Hasbiconni/Tagent  │
│ ├─ Branch: main                     │
│ └─ Root Directory: worker/          │ ← CRITICAL!
│                                     │
│ Build                               │
│ └─ Builder: Dockerfile              │ ← CRITICAL!
│                                     │
│ Deploy                              │
│ ├─ Start Command: (auto)           │
│ └─ Custom Start: (empty)           │
│                                     │
└─────────────────────────────────────┘
```

---

## 🔍 **Alternative: Create railway.json in worker/ directory**

If the UI doesn't work, create this file:


