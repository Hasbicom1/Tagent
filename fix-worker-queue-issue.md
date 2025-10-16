# 🔍 Worker Not Processing Jobs - Diagnostic & Fix

## Current Status

✅ **What's Working:**
- Build succeeds, application deployed
- Redis connection established (no auth errors)
- Frontend polling session status
- JWT token authentication working

❌ **What's Broken:**
- Session stuck in `status: 'queued'` indefinitely
- `workerReady: false` never becomes `true`
- `browserReady: false` never becomes `true`
- Worker service is NOT picking up jobs from BullMQ queue
- WebSocket shows "Connection Error - Failed to establish real-time connection"

## Root Cause Analysis

The worker container is **not consuming jobs from the BullMQ queue**. This can happen for several reasons:

1. **Worker process isn't starting the queue consumer**
2. **BullMQ connection failing silently**
3. **Queue name mismatch** between job producer and consumer
4. **Redis connection in worker is different from main app**
5. **Worker environment variables missing or incorrect**

---

## Task: Enable Worker Job Processing

### Step 1: Verify Worker Service Configuration

Check Railway → Worker service → ensure these variables exist:

```bash
REDIS_URL=redis://... (or REDIS_PRIVATE_URL)
REDIS_PASSWORD=<password>
NODE_ENV=production
```

**Critical:** The worker MUST have access to the same Redis instance as the main app.

### Step 2: Check Worker Entry Point

The worker service should have a dedicated entry point that starts the queue processor. Check your Railway configuration:

**Option A: Separate worker process (recommended)**
In Railway → Worker service → Settings → Start Command:
```bash
node server/worker.js
```

**Option B: Combined process**
If using one service for both web and worker:
```bash
node server/index.js
```

### Step 3: Verify Queue Processor Code

The worker needs to actively consume jobs. Check your worker code (likely `server/worker.js` or similar):

**Required structure:**
```javascript
import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';

// IMPORTANT: Use same Redis config as main app
const redisUrl = process.env.REDIS_URL || process.env.REDIS_PRIVATE_URL;
const redisPassword = process.env.REDIS_PASSWORD || process.env.RAILWAY_REDIS_PASSWORD;
const redisUsername = process.env.REDIS_USERNAME || process.env.RAILWAY_REDIS_USERNAME || 'default';

// Parse URL for connection
const urlObj = new URL(redisUrl);

const connection = {
  host: urlObj.hostname,
  port: parseInt(urlObj.port || '6379', 10),
  password: redisPassword,
  username: redisUsername,
  maxRetriesPerRequest: null,
  enableReadyCheck: false
};

// Create Worker (NOT Queue) to process jobs
const worker = new Worker(
  'session-provision', // MUST match queue name used when adding jobs
  async (job) => {
    console.log(`🔧 WORKER: Processing job ${job.id} for session ${job.data.sessionId}`);
    
    try {
      // Your browser provisioning logic here
      const { sessionId, userId } = job.data;
      
      // Start browser, setup stream, etc.
      await provisionBrowserSession(sessionId, userId);
      
      console.log(`✅ WORKER: Job ${job.id} completed successfully`);
      return { success: true };
    } catch (error) {
      console.error(`❌ WORKER: Job ${job.id} failed:`, error);
      throw error;
    }
  },
  { connection }
);

// Event listeners for debugging
worker.on('completed', (job) => {
  console.log(`✅ WORKER: Job ${job.id} has completed`);
});

worker.on('failed', (job, err) => {
  console.error(`❌ WORKER: Job ${job?.id} has failed with error:`, err.message);
});

worker.on('error', (err) => {
  console.error('❌ WORKER: Worker error:', err);
});

worker.on('ready', () => {
  console.log('🚀 WORKER: Worker is ready and waiting for jobs');
});

console.log('🔥 WORKER: Starting provision worker...');
```

### Step 4: Verify Queue Name Consistency

**CRITICAL:** The queue name must match exactly between producer and consumer.

**When creating the session (producer side):**
```javascript
// In your API endpoint that creates sessions
const sessionQueue = new Queue('session-provision', { connection });
await sessionQueue.add('provision-browser', {
  sessionId: 'agent_123',
  userId: 'user_456'
});
```

**In worker (consumer side):**
```javascript
const worker = new Worker('session-provision', async (job) => { ... }, { connection });
```

**Both must use the same string:** `'session-provision'`

### Step 5: Check Worker Logs

After ensuring the above, check Railway → Worker service → Logs for:

**✅ Success logs should show:**
```
🔥 WORKER: Starting provision worker...
🚀 WORKER: Worker is ready and waiting for jobs
🔧 WORKER: Processing job <id> for session agent_xxxxx
✅ WORKER: Job <id> completed successfully
```

**❌ If you see:**
```
(nothing about worker starting)
```
→ Worker process isn't running at all

**❌ If you see:**
```
Worker started but no "Processing job" messages
```
→ Jobs aren't being consumed (Redis connection or queue name mismatch)

**❌ If you see:**
```
Redis connection error
```
→ Redis credentials still not working in worker

### Step 6: Add Extensive Logging

Temporarily add detailed logging to help diagnose:

```javascript
// At the very start of your worker file
console.log('🔍 WORKER DEBUG:', {
  NODE_ENV: process.env.NODE_ENV,
  hasRedisUrl: !!process.env.REDIS_URL,
  hasRedisPrivateUrl: !!process.env.REDIS_PRIVATE_URL,
  hasRedisPassword: !!process.env.REDIS_PASSWORD,
  redisUrlStart: process.env.REDIS_URL?.substring(0, 15),
  redisHost: urlObj.hostname,
  redisPort: urlObj.port
});

// Before creating worker
console.log('🔍 WORKER: Creating worker with connection:', {
  host: connection.host,
  port: connection.port,
  hasPassword: !!connection.password,
  hasUsername: !!connection.username
});

// After creating worker
console.log('🔍 WORKER: Worker instance created:', {
  name: worker.name,
  isRunning: worker.isRunning()
});
```

### Step 7: Verify Job is Being Added to Queue

In your session creation endpoint, add logging:

```javascript
app.post('/api/create-session', async (req, res) => {
  const sessionId = `agent_${Date.now()}`;
  
  // Add job to queue
  console.log(`📤 Adding job to queue for session: ${sessionId}`);
  const job = await sessionQueue.add('provision-browser', {
    sessionId,
    userId: req.user.id
  });
  console.log(`📤 Job added with ID: ${job.id}`);
  
  // Check if job is in queue
  const jobStatus = await job.getState();
  console.log(`📤 Job ${job.id} state: ${jobStatus}`);
  
  res.json({ sessionId });
});
```

### Step 8: Check if Worker Service is Scaled

In Railway:
1. Go to Worker service
2. Check "Deployments" - should show as "Active"
3. Check "Metrics" - should show CPU/Memory usage
4. If no activity → worker isn't running

### Step 9: Separate Worker Deployment (if needed)

If your worker isn't running, you might need to create a separate Railway service:

1. **Add a new service in Railway**
2. **Connect to same GitHub repo**
3. **Set Start Command:** `node server/worker.js`
4. **Add environment variables:**
   - Copy all variables from main service
   - Especially REDIS_* variables
5. **Deploy**

---

## Quick Diagnostic Checklist

Run through this checklist:

- [ ] Worker service exists in Railway
- [ ] Worker service has REDIS_URL and REDIS_PASSWORD
- [ ] Worker service is "Active" (not crashed)
- [ ] Worker logs show "Worker is ready and waiting for jobs"
- [ ] Job is being added to queue (check main app logs)
- [ ] Queue name matches between producer and consumer
- [ ] Redis connection working in worker (no auth errors)
- [ ] Worker is using same Redis instance as main app

---

## Expected Flow

**When everything works:**

1. User creates session → API adds job to `session-provision` queue
2. Worker picks up job from queue
3. Worker provisions browser (starts Chrome, Xvfb, VNC, etc.)
4. Worker updates session status to `ready: true`, `workerReady: true`
5. Worker starts WebSocket stream
6. Frontend receives status update and connects to stream
7. User sees browser interface

**Current broken flow:**

1. User creates session → API adds job to queue ✅
2. Worker picks up job → **❌ NOT HAPPENING**
3. Session stays in `queued` state forever
4. Frontend keeps polling, never gets `ready: true`

---

## Testing the Fix

After implementing changes:

1. **Check worker logs:**
   ```
   🚀 WORKER: Worker is ready and waiting for jobs
   ```

2. **Create a new session**

3. **Watch worker logs for:**
   ```
   🔧 WORKER: Processing job X for session agent_Y
   ```

4. **Check session status API:**
   ```json
   {
     "status": "ready",
     "ready": true,
     "workerReady": true,
     "browserReady": true
   }
   ```

5. **Frontend should show browser stream**

---

## If Still Not Working

Provide these details:

1. **Railway worker service logs** (last 50 lines)
2. **Railway main service logs** (around session creation)
3. **Worker service environment variables** (redact sensitive values)
4. **Output of this debug endpoint:**

```javascript
app.get('/api/queue-debug', async (req, res) => {
  const queue = new Queue('session-provision', { connection });
  
  const waiting = await queue.getWaitingCount();
  const active = await queue.getActiveCount();
  const completed = await queue.getCompletedCount();
  const failed = await queue.getFailedCount();
  
  res.json({
    counts: { waiting, active, completed, failed },
    connection: {
      hasUrl: !!process.env.REDIS_URL,
      hasPassword: !!process.env.REDIS_PASSWORD
    }
  });
});
```

---

## Summary

**The fix:** Ensure the worker service is actually running and consuming jobs from the BullMQ queue with the correct Redis connection.

**Key files to check/modify:**
1. `server/worker.js` - Worker process
2. Railway worker service configuration
3. Worker environment variables

**Priority:** 🔴 CRITICAL
**Estimated Time:** 20-30 minutes
**Complexity:** Medium
