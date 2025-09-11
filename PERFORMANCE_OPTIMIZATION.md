# ⚡ AGENT HQ - PERFORMANCE OPTIMIZATION GUIDE

## **CURRENT PERFORMANCE ANALYSIS**

### **✅ ALREADY OPTIMIZED:**
- **Dual API Failover**: Intelligent redundancy with timeouts (10s primary → 8s fallback)
- **Resource Monitoring**: Real-time CPU/Memory tracking with alerts
- **Connection Pooling**: Database and Redis connection management
- **Security Caching**: Session validation with Redis caching
- **Queue System**: BullMQ for scalable task processing
- **WebSocket Optimization**: Origin validation with connection limits

### **🎯 PERFORMANCE TARGETS:**
- **API Response Time**: < 500ms (95th percentile)
- **Page Load Time**: < 3 seconds (First Contentful Paint)
- **Browser Automation**: < 30 seconds per task
- **WebSocket Latency**: < 100ms
- **Memory Usage**: < 512MB per worker
- **CPU Usage**: < 50% average

---

## **FRONTEND PERFORMANCE OPTIMIZATIONS**

### **Bundle Size Optimization**
```bash
# Check current bundle size
npm run build

# Target bundle sizes:
# - Main bundle: < 500KB gzipped
# - Vendor bundle: < 200KB gzipped
# - CSS bundle: < 50KB gzipped
```

### **Code Splitting Implementation**
```typescript
// Route-based code splitting (using actual paths)
const NotFound = lazy(() => import('@/pages/not-found'));

// Component-based splitting for heavy components  
const AgentInterface = lazy(() => import('@/components/agent/AgentInterface'));
const PaymentFlow = lazy(() => import('@/components/payment/PaymentFlow'));
```

### **Asset Optimization**
**⚠️ NOTE: Vite configuration changes are FORBIDDEN in this project.**
**Use built-in optimization instead:**
- Bundle size check: `npm run build`
- Automatic code splitting via dynamic imports
- Built-in minification and tree-shaking
- Radix UI components are already optimized

---

## **BACKEND PERFORMANCE OPTIMIZATIONS**

### **Database Query Optimization**
**Based on actual schema from `shared/schema.ts`:**
```sql
-- Add performance indexes for actual tables
CREATE INDEX CONCURRENTLY idx_sessions_agent_expires 
ON sessions(agent_id, expires_at) WHERE is_active = true;

CREATE INDEX CONCURRENTLY idx_messages_session_timestamp 
ON messages(session_id, timestamp DESC);

CREATE INDEX CONCURRENTLY idx_tasks_status_created 
ON tasks(status, created_at DESC);

CREATE INDEX CONCURRENTLY idx_task_results_task_id 
ON task_results(task_id, created_at DESC);

-- Query performance targets:
-- Session lookup: < 10ms
-- Message history: < 20ms  
-- Health checks: < 5ms
```

### **Redis Performance Tuning**
```bash
# Redis configuration optimization
# /etc/redis/redis.conf

# Memory optimization
maxmemory 256mb
maxmemory-policy allkeys-lru

# Connection optimization
tcp-keepalive 60
timeout 300

# Performance tuning
save 900 1
save 300 10
save 60 10000

# Monitor Redis performance
redis-cli INFO stats
redis-cli INFO memory
redis-cli SLOWLOG GET 10
```

### **Express.js Optimization**
**⚠️ PRODUCTION ONLY - Add to server/index.ts after existing middleware:**
```typescript
// Compression middleware (PRODUCTION ONLY)
if (process.env.NODE_ENV === 'production') {
  app.use(compression({
    filter: (req, res) => {
      if (req.headers['x-no-compression']) return false;
      return compression.filter(req, res);
    },
    level: 6,
    threshold: 1024
  }));
}

// Response caching for health endpoint
app.use('/api/health', (req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    res.set('Cache-Control', 'public, max-age=30');
  }
  next();
});

// Database connection pooling is already optimized in existing code
```

---

## **AI API PERFORMANCE OPTIMIZATION**

### **Request Optimization**
```typescript
// Optimized AI request configuration
const optimizedRequest = {
  model: "gpt-oss-120b",
  messages,
  response_format: { type: "json_object" },
  temperature: 0.7,
  max_tokens: 300, // Reduced from 500 for faster responses
  timeout: 8000,   // Reduced timeout for faster failover
  stream: false    // Disable streaming for JSON responses
};

// Connection pooling for AI APIs
const aiHttpAgent = new Agent({
  keepAlive: true,
  maxSockets: 10,
  timeout: 8000
});
```

### **Caching Strategy**
```typescript
// Response caching for similar requests
const responseCache = new Map();

async function getCachedResponse(prompt: string): Promise<string | null> {
  const hash = createHash('sha256').update(prompt).digest('hex');
  const cached = responseCache.get(hash);
  
  if (cached && (Date.now() - cached.timestamp) < 300000) { // 5 min cache
    return cached.response;
  }
  
  return null;
}
```

---

## **BROWSER AUTOMATION OPTIMIZATION**

### **Browser Pool Management**
```typescript
// Optimized browser pool configuration
const browserPoolConfig = {
  maxSize: 3,
  minSize: 1,
  idleTimeout: 60000,
  acquireTimeout: 30000,
  launchOptions: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--single-process',
      '--no-zygote',
      '--memory-pressure-off',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
    ]
  }
};
```

### **Task Optimization**
```typescript
// Optimized task execution
async function executeTaskOptimized(task: BrowserTask): Promise<TaskResult> {
  const startTime = performance.now();
  
  try {
    // Use page reuse when possible
    const page = await getBrowserPage({ reuse: true });
    
    // Set optimized timeouts
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(30000);
    
    // Enable request interception for performance
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (['image', 'font', 'media'].includes(resourceType)) {
        req.abort(); // Block non-essential resources
      } else {
        req.continue();
      }
    });
    
    const result = await executeTask(page, task);
    
    // Performance logging
    const executionTime = performance.now() - startTime;
    console.log(`⚡ Task completed in ${executionTime.toFixed(2)}ms`);
    
    return result;
  } catch (error) {
    throw error;
  }
}
```

---

## **MONITORING & ALERTS**

### **Performance Monitoring Setup**
```javascript
// Custom performance metrics
const performanceMetrics = {
  apiResponseTime: new Histogram({
    name: 'api_response_time_ms',
    help: 'API response time in milliseconds',
    labelNames: ['endpoint', 'method', 'status'],
    buckets: [10, 50, 100, 200, 500, 1000, 2000]
  }),
  
  taskExecutionTime: new Histogram({
    name: 'browser_task_duration_ms', 
    help: 'Browser task execution time',
    buckets: [1000, 5000, 10000, 15000, 30000, 60000]
  }),
  
  memoryUsage: new Gauge({
    name: 'process_memory_usage_bytes',
    help: 'Process memory usage'
  })
};

// Performance middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    performanceMetrics.apiResponseTime
      .labels(req.route?.path || req.path, req.method, res.statusCode)
      .observe(duration);
  });
  next();
});
```

### **Alert Thresholds**
```yaml
# Performance alerts configuration
alerts:
  response_time_high:
    threshold: 500ms
    duration: 2m
    action: "Scale horizontally"
    
  memory_usage_high: 
    threshold: 80%
    duration: 5m
    action: "Restart worker"
    
  error_rate_high:
    threshold: 5%
    duration: 1m
    action: "Investigate immediately"
    
  queue_backlog_high:
    threshold: 50
    duration: 5m
    action: "Add worker capacity"
```

---

## **LOAD TESTING & BENCHMARKS**

### **API Load Testing**
```bash
# Basic load test
ab -n 1000 -c 50 https://yourdomain.com/api/health

# Message endpoint load test  
ab -n 500 -c 25 -T 'application/json' -p message.json https://yourdomain.com/api/session/TEST/message

# WebSocket connection test
wscat -c wss://yourdomain.com/ws -x '{"type":"ping"}' 

# Expected results:
# - 99% requests < 200ms
# - 0% error rate
# - Throughput > 1000 requests/sec
```

### **Browser Automation Benchmarks**
```bash
# Task execution performance test
curl -X POST https://yourdomain.com/api/session/TEST/execute \
  -H "Content-Type: application/json" \
  -d '{"taskDescription":"Navigate to google.com","csrfToken":"1234567890123456"}'

# Expected results:
# - Task completion < 15 seconds
# - Success rate > 95%
# - Memory usage < 512MB per browser
```

---

## **OPTIMIZATION CHECKLIST**

### **✅ Frontend Optimizations**
- [ ] Bundle size < 500KB gzipped
- [ ] Code splitting implemented
- [ ] Asset compression enabled
- [ ] CDN configured for static assets
- [ ] Service worker for caching

### **✅ Backend Optimizations**  
- [ ] Database indexes created
- [ ] Query response times < 10ms
- [ ] Redis caching implemented
- [ ] Connection pooling configured
- [ ] Compression middleware enabled

### **✅ Infrastructure Optimizations**
- [ ] Load balancer configured
- [ ] Auto-scaling rules set
- [ ] CDN for static content
- [ ] Database read replicas (if needed)
- [ ] Redis clustering (if needed)

### **✅ Monitoring Setup**
- [ ] Performance metrics collection
- [ ] Alert thresholds configured  
- [ ] Dashboard created
- [ ] Log aggregation setup
- [ ] Error tracking enabled

---

## **🚀 PERFORMANCE TARGETS ACHIEVED**

**When optimization is complete, you should see:**
- ⚡ **Sub-500ms** API responses (95th percentile)
- 🏃 **Sub-3s** page load times  
- 🤖 **Sub-30s** browser automation
- 📡 **Sub-100ms** WebSocket latency
- 💾 **<512MB** memory per worker
- 🖥️ **<50%** CPU usage average

**Your Agent HQ will deliver lightning-fast performance!** ⚡