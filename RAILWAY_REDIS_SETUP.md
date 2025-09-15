# Railway Redis Addon Setup & Configuration

## Overview
Complete guide for configuring Railway's managed Redis addon for OneDollarAgent.ai production deployment with session management, caching, and queue processing.

---

## Phase 1: Add Redis Addon to Railway

### 1.1 Add Redis Service
```bash
# Using Railway CLI
railway add redis

# Or via Railway Dashboard:
# 1. Go to your project dashboard
# 2. Click "Add Service"
# 3. Select "Redis" from available addons
# 4. Confirm addon addition
```

### 1.2 Verify Redis Installation
```bash
# Check service status
railway status

# View Redis-specific information
railway info redis
```

Expected output:
```
✅ Redis addon successfully added
📋 Connection URL: ${{Redis.REDIS_URL}}
🔧 Version: Redis 7.x
💾 Memory: 256MB (scalable)
🔒 Authentication: Enabled
```

---

## Phase 2: Environment Variable Configuration

### 2.1 Automatic Environment Variables
Railway automatically creates these environment variables when Redis is added:

```bash
REDIS_URL=redis://default:password@redis.railway.internal:6379
```

### 2.2 Verify Environment Variables
```bash
# Check all environment variables
railway vars

# Check Redis-specific variables
railway vars | grep REDIS
```

### 2.3 Application Integration
The application automatically detects Railway Redis configuration through:

1. **Environment Detection**: App detects `RAILWAY_ENVIRONMENT` variable
2. **Redis URL**: Automatically uses `${{Redis.REDIS_URL}}` from addon
3. **Production Mode**: Forces production configuration when Railway detected

---

## Phase 3: Redis Configuration in Application

### 3.1 Connection Settings
The application uses these optimized Redis settings for Railway:

```typescript
// server/index.ts - Redis Connection Config
const redisInstance = new Redis(process.env.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 3,
  connectTimeout: 5000,
  commandTimeout: 5000,
  enableAutoPipelining: true,
  enableOfflineQueue: false,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3
});
```

### 3.2 Redis Usage in Application

#### Session Storage
```typescript
// Production session management with Redis
const redisStore = createRedisSessionStore(redisInstance);
app.use(session({
  store: redisStore,
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    secure: true,        // HTTPS only
    httpOnly: true,      // XSS protection
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'strict'   // CSRF protection
  }
}));
```

#### Queue Processing
```typescript
// BullMQ job queue with Redis
const taskQueue = new Queue('agent-tasks', {
  connection: redisInstance,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  }
});
```

#### Caching Layer
```typescript
// Application-level caching
const cache = {
  async get(key: string) {
    return await redisInstance.get(key);
  },
  async set(key: string, value: string, ttl: number = 3600) {
    return await redisInstance.setex(key, ttl, value);
  },
  async del(key: string) {
    return await redisInstance.del(key);
  }
};
```

---

## Phase 4: Redis Performance Optimization

### 4.1 Memory Management
```bash
# Monitor Redis memory usage
railway connect redis
> INFO memory
> CONFIG GET maxmemory-policy
```

### 4.2 Optimal Redis Configuration
Railway Redis comes pre-configured with production settings:

```redis
# Automatic settings applied by Railway
maxmemory 256mb
maxmemory-policy allkeys-lru
timeout 300
tcp-keepalive 60
save 900 1
save 300 10
save 60 10000
```

### 4.3 Connection Pool Optimization
```typescript
// Optimized connection pooling for Railway
const redisPool = {
  maxConnections: 10,
  minConnections: 2,
  acquireTimeoutMillis: 60000,
  createTimeoutMillis: 30000,
  destroyTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  reapIntervalMillis: 1000,
  createRetryIntervalMillis: 200
};
```

---

## Phase 5: Production Monitoring

### 5.1 Redis Health Checks
```typescript
// Health check endpoint includes Redis status
app.get('/health/redis', async (req, res) => {
  try {
    const start = Date.now();
    await redisInstance.ping();
    const latency = Date.now() - start;
    
    const info = await redisInstance.info('memory');
    const used_memory = info.match(/used_memory:(\d+)/)?.[1];
    
    res.json({
      status: 'healthy',
      latency: `${latency}ms`,
      used_memory: used_memory ? `${(parseInt(used_memory) / 1024 / 1024).toFixed(2)}MB` : 'unknown',
      connected: true
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      connected: false
    });
  }
});
```

### 5.2 Performance Metrics
Monitor these key Redis metrics:

```bash
# Connect to Redis instance
railway connect redis

# Check connection info
> INFO clients
> INFO stats
> INFO commandstats
> INFO memory
> INFO persistence
```

Key metrics to monitor:
- **Memory Usage**: Keep below 80% of allocated memory
- **Connection Count**: Monitor concurrent connections
- **Hit Rate**: Cache efficiency ratio
- **Command Latency**: Response time performance
- **Persistence**: Data durability status

---

## Phase 6: Scaling & High Availability

### 6.1 Vertical Scaling
Railway Redis supports automatic scaling:

```bash
# Check current Redis plan
railway info redis

# Upgrade Redis memory (via dashboard)
# Plans available: 256MB, 512MB, 1GB, 2GB, 4GB, 8GB
```

### 6.2 Connection Limits
Railway Redis connection limits by plan:

| Plan   | Memory | Max Connections | Max Databases |
|--------|--------|----------------|---------------|
| 256MB  | 256MB  | 100            | 16            |
| 512MB  | 512MB  | 200            | 16            |
| 1GB    | 1GB    | 300            | 16            |
| 2GB+   | 2GB+   | 500            | 16            |

### 6.3 Backup & Recovery
Railway provides automatic Redis snapshots:

- **Frequency**: Daily backups automatically
- **Retention**: 7 days of backup history
- **Recovery**: Point-in-time recovery available
- **Manual Backup**: Available via Railway dashboard

---

## Phase 7: Security Configuration

### 7.1 Redis Security Features
Railway Redis includes enterprise security:

```bash
# Security features enabled by default:
# - Authentication required (password protected)
# - Encrypted connections (TLS/SSL)
# - Network isolation (internal Railway network)
# - Access control lists (ACLs)
# - Regular security patches
```

### 7.2 Connection Security
```typescript
// Secure Redis connection configuration
const secureRedis = new Redis(process.env.REDIS_URL, {
  tls: {
    rejectUnauthorized: false  // Railway handles cert management
  },
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  maxRetriesPerRequest: 3,
  lazyConnect: true
});
```

### 7.3 Data Encryption
- **In Transit**: All connections use TLS encryption
- **At Rest**: Data encrypted on Railway infrastructure
- **Authentication**: Password authentication required
- **Network**: Isolated within Railway private network

---

## Phase 8: Troubleshooting

### Common Redis Issues & Solutions

#### Issue 1: Connection Timeouts
**Symptoms:**
```
❌ REDIS: Connection failed - getaddrinfo ENOTFOUND redis.railway.internal
```

**Solutions:**
1. **Check Service Status**: Verify Redis addon is running
   ```bash
   railway status
   ```

2. **Verify Environment Variables**:
   ```bash
   railway vars | grep REDIS_URL
   ```

3. **Restart Services**:
   ```bash
   railway redeploy
   ```

#### Issue 2: Memory Limit Exceeded
**Symptoms:**
```
❌ REDIS: OOM command not allowed when used memory > 'maxmemory'
```

**Solutions:**
1. **Check Memory Usage**:
   ```bash
   railway connect redis
   > INFO memory
   ```

2. **Clear Unnecessary Data**:
   ```bash
   > FLUSHDB  # Clear current database
   > FLUSHALL # Clear all databases (use with caution)
   ```

3. **Upgrade Plan**: Increase Redis memory limit in Railway dashboard

#### Issue 3: High Connection Count
**Symptoms:**
```
❌ REDIS: Too many connections
```

**Solutions:**
1. **Monitor Connections**:
   ```bash
   > INFO clients
   > CLIENT LIST
   ```

2. **Optimize Connection Pool**: Reduce max connections in application
3. **Check for Connection Leaks**: Ensure proper connection cleanup

#### Issue 4: Performance Degradation
**Symptoms:**
- Slow Redis commands
- High latency
- Timeout errors

**Solutions:**
1. **Analyze Slow Queries**:
   ```bash
   > SLOWLOG GET 10
   > INFO commandstats
   ```

2. **Optimize Data Structure**: Use appropriate Redis data types
3. **Implement Caching Strategy**: Reduce unnecessary Redis calls
4. **Scale Vertically**: Upgrade to higher memory plan

---

## Phase 9: Production Best Practices

### 9.1 Data Persistence Strategy
```typescript
// Implement graceful Redis reconnection
redisInstance.on('error', (error) => {
  console.error('Redis connection error:', error);
  // Implement fallback mechanism
});

redisInstance.on('reconnecting', () => {
  console.log('Redis reconnecting...');
});

redisInstance.on('ready', () => {
  console.log('Redis connection restored');
});
```

### 9.2 Key Naming Conventions
```typescript
// Structured key naming for easy management
const keys = {
  session: (sessionId: string) => `session:${sessionId}`,
  user: (userId: string) => `user:${userId}`,
  cache: (key: string) => `cache:${key}`,
  queue: (jobId: string) => `queue:job:${jobId}`,
  rate_limit: (ip: string) => `rate_limit:${ip}`
};
```

### 9.3 TTL Management
```typescript
// Implement proper TTL for different data types
const ttlConfig = {
  session: 24 * 60 * 60,        // 24 hours
  cache: 60 * 60,               // 1 hour
  rate_limit: 60 * 15,          // 15 minutes
  temporary: 60 * 5,            // 5 minutes
  long_term: 24 * 60 * 60 * 7   // 1 week
};
```

---

## Phase 10: Monitoring & Alerts

### 10.1 Application-Level Monitoring
```typescript
// Redis metrics collection
const collectRedisMetrics = async () => {
  const info = await redisInstance.info();
  const metrics = {
    connected_clients: parseInt(info.match(/connected_clients:(\d+)/)?.[1] || '0'),
    used_memory: parseInt(info.match(/used_memory:(\d+)/)?.[1] || '0'),
    keyspace_hits: parseInt(info.match(/keyspace_hits:(\d+)/)?.[1] || '0'),
    keyspace_misses: parseInt(info.match(/keyspace_misses:(\d+)/)?.[1] || '0'),
    total_commands_processed: parseInt(info.match(/total_commands_processed:(\d+)/)?.[1] || '0')
  };
  
  // Calculate hit rate
  const total_requests = metrics.keyspace_hits + metrics.keyspace_misses;
  const hit_rate = total_requests > 0 ? (metrics.keyspace_hits / total_requests * 100).toFixed(2) : '0';
  
  console.log('Redis Metrics:', { ...metrics, hit_rate: `${hit_rate}%` });
  return metrics;
};
```

### 10.2 Health Check Integration
```typescript
// Include Redis in comprehensive health checks
app.get('/health/complete', async (req, res) => {
  const checks = await Promise.allSettled([
    // Database check
    db.query('SELECT 1'),
    
    // Redis check
    redisInstance.ping(),
    
    // External API checks
    fetch('https://api.openai.com/v1/models', {
      headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` }
    })
  ]);
  
  const results = {
    database: checks[0].status === 'fulfilled' ? 'healthy' : 'unhealthy',
    redis: checks[1].status === 'fulfilled' ? 'healthy' : 'unhealthy',
    openai: checks[2].status === 'fulfilled' ? 'healthy' : 'unhealthy'
  };
  
  const allHealthy = Object.values(results).every(status => status === 'healthy');
  
  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'healthy' : 'unhealthy',
    checks: results,
    timestamp: new Date().toISOString()
  });
});
```

---

## Final Production Checklist

### Redis Configuration
- [ ] Redis addon added to Railway project
- [ ] Environment variables automatically configured
- [ ] Connection settings optimized for production
- [ ] Memory limits configured appropriately
- [ ] Backup strategy implemented

### Application Integration
- [ ] Session storage using Redis
- [ ] Queue processing configured
- [ ] Caching layer implemented
- [ ] Error handling for Redis failures
- [ ] Graceful reconnection logic

### Security & Performance
- [ ] TLS encryption enabled
- [ ] Authentication configured
- [ ] Connection pooling optimized
- [ ] Memory usage monitoring
- [ ] Performance metrics collection

### Monitoring & Maintenance
- [ ] Health checks include Redis status
- [ ] Alert system for Redis failures
- [ ] Log aggregation for Redis errors
- [ ] Regular performance review scheduled
- [ ] Backup verification process

---

This completes the comprehensive Redis addon setup for Railway deployment with production-grade configuration, monitoring, and optimization for OneDollarAgent.ai.