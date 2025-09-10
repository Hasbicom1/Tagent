# PHOENIX-7742 Containerized Browser Automation Worker

A scalable, containerized browser automation worker system that integrates with Redis + BullMQ queue systems to provide real-time browser automation capabilities for 1000+ concurrent users.

## Architecture Overview

The worker system consists of containerized Playwright workers that:
- Connect to Redis + BullMQ for task distribution
- Execute browser automation using Playwright
- Report progress via WebSocket integration
- Support horizontal scaling for high concurrency

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Redis server (included in docker-compose or external)
- OpenAI API key (optional, for AI-powered automation planning)

### Basic Deployment

1. **Build and start workers:**
```bash
# Start with 2 dedicated workers
docker-compose -f docker-compose.worker.yml up -d

# Or scale to more workers
docker-compose -f docker-compose.worker.yml up -d --scale worker-scale=5
```

2. **Environment configuration:**
```bash
# Create .env file
cat > .env << EOF
OPENAI_API_KEY=your_openai_api_key_here
REDIS_URL=redis://localhost:6379
EOF
```

3. **Monitor worker health:**
```bash
# Check individual worker health
curl http://localhost:3001/health
curl http://localhost:3002/health

# View logs
docker-compose -f docker-compose.worker.yml logs -f worker-1
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WORKER_ID` | `worker-{random}` | Unique worker identifier |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `BROWSER_TYPE` | `chromium` | Browser engine (chromium/firefox/webkit) |
| `HEADLESS` | `true` | Run browser in headless mode |
| `MAX_CONCURRENT_TASKS` | `3` | Max concurrent tasks per worker |
| `MAX_CONCURRENT_BROWSERS` | `3` | Max browser sessions per worker |
| `TASK_TIMEOUT` | `300000` | Task timeout in milliseconds (5 min) |
| `SESSION_TIMEOUT` | `600000` | Browser session timeout (10 min) |
| `HEALTH_CHECK_PORT` | `3001` | Health check HTTP port |
| `OPENAI_API_KEY` | - | OpenAI API key for AI planning |

### Resource Limits

Default resource limits per worker:
- **CPU**: 2.0 cores (limit), 0.5 cores (reserved)
- **Memory**: 4GB (limit), 1GB (reserved)
- **Scaled workers**: 1.5 CPU cores, 3GB memory

## Scaling

### Horizontal Scaling

Scale workers based on load:

```bash
# Scale to 10 workers
docker-compose -f docker-compose.worker.yml up -d --scale worker-scale=10

# Scale down to 3 workers
docker-compose -f docker-compose.worker.yml up -d --scale worker-scale=3
```

### Auto-scaling with Docker Swarm

```bash
# Deploy to Docker Swarm for auto-scaling
docker stack deploy -c docker-compose.worker.yml phoenix-workers

# Scale service
docker service scale phoenix-workers_worker-scale=20
```

### Kubernetes Deployment

See `k8s/` directory for Kubernetes manifests with HPA (Horizontal Pod Autoscaler).

## Monitoring

### Health Checks

Workers expose health check endpoints:

```bash
# Check worker health
curl http://localhost:3001/health

# Response example:
{
  "status": "healthy",
  "workerId": "worker-1",
  "uptime": "120.45s",
  "stats": {
    "tasksProcessed": 15,
    "tasksSucceeded": 14,
    "tasksFailed": 1,
    "successRate": "93.3%"
  },
  "checks": {
    "redis": true,
    "worker": true,
    "browser": true,
    "memory": true
  }
}
```

### Logs and Metrics

```bash
# View worker logs
docker-compose -f docker-compose.worker.yml logs -f

# Monitor queue status
docker-compose -f docker-compose.worker.yml logs worker-monitor

# Redis queue inspection
docker exec phoenix-redis redis-cli monitor
```

## Development

### Local Development

```bash
# Install dependencies
cd worker
npm install

# Build TypeScript
npm run build

# Start worker locally
REDIS_URL=redis://localhost:6379 npm run dev

# Run health check
npm run health
```

### Testing

```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# Load testing
npm run test:load
```

### Debugging

```bash
# Debug mode with verbose logging
NODE_ENV=development DEBUG=* npm run dev

# Inspect browser automation
HEADLESS=false npm run dev

# Debug with remote browser
BROWSER_DEBUG_PORT=9222 npm run dev
```

## Integration

### Queue Integration

Workers consume tasks from the `agent-tasks` queue with these task types:

- `BROWSER_AUTOMATION`: Execute browser automation
- `SESSION_START`: Initialize session
- `SESSION_END`: Cleanup session

### WebSocket Integration

Progress updates are broadcast via Redis pub/sub to WebSocket clients:

```javascript
// Progress update format
{
  type: 'task_progress',
  jobId: 'job_123',
  workerId: 'worker-1',
  progress: 75,
  stage: 'Executing automation sequence',
  logs: ['Step 1 completed', 'Step 2 in progress'],
  timestamp: '2025-01-01T12:00:00.000Z'
}
```

### Task Payload Examples

**Browser Automation Task:**
```javascript
{
  type: 'BROWSER_AUTOMATION',
  payload: {
    instruction: 'Navigate to Google and search for "AI agents"',
    sessionId: 'session_123',
    agentId: 'agent_456',
    url: 'https://google.com',
    context: { searchTerm: 'AI agents' }
  }
}
```

## Performance Optimization

### Memory Management

- Browser sessions auto-cleanup after timeout
- Configurable concurrent session limits
- Resource monitoring with alerts

### CPU Optimization

- Efficient task scheduling
- Graceful degradation under load
- CPU usage monitoring

### Network Optimization

- Redis connection pooling
- Compression for large payloads
- CDN integration for static assets

## Security

### Container Security

- Non-root user execution
- Read-only filesystem where possible
- Security options: `no-new-privileges`
- Resource limits prevent DoS

### Browser Security

- Sandboxed browser execution
- Disabled file system access
- Network restrictions
- Input validation and sanitization

## Troubleshooting

### Common Issues

**Worker not connecting to Redis:**
```bash
# Check Redis connectivity
docker exec phoenix-worker-1 redis-cli -h redis ping

# Verify environment variables
docker exec phoenix-worker-1 printenv | grep REDIS
```

**Browser launch failures:**
```bash
# Check browser dependencies
docker exec phoenix-worker-1 npx playwright install-deps --dry-run

# Test browser launch
docker exec phoenix-worker-1 npx playwright test --browser=chromium
```

**High memory usage:**
```bash
# Monitor memory usage
docker stats phoenix-worker-1

# Check browser sessions
docker exec phoenix-worker-1 curl localhost:3001/health
```

### Performance Tuning

**For high-throughput scenarios:**
```yaml
# Increase worker resources
deploy:
  resources:
    limits:
      cpus: '4.0'
      memory: 8G

# Reduce session timeout
environment:
  - SESSION_TIMEOUT=300000  # 5 minutes
  - MAX_CONCURRENT_BROWSERS=5
```

**For memory-constrained environments:**
```yaml
# Reduce concurrent tasks
environment:
  - MAX_CONCURRENT_TASKS=1
  - MAX_CONCURRENT_BROWSERS=1
  - SESSION_TIMEOUT=180000  # 3 minutes
```

## API Reference

### Health Check Endpoint

**GET** `/health`

Returns worker health status including:
- Overall health status
- Individual component checks
- Performance metrics
- Resource usage

### Task Processing

Workers automatically process tasks from the `agent-tasks` queue. No direct API interaction required.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Update documentation
5. Submit pull request

## License

MIT License - see LICENSE file for details.

## Support

- Documentation: [GitHub Wiki](https://github.com/your-org/phoenix-7742/wiki)
- Issues: [GitHub Issues](https://github.com/your-org/phoenix-7742/issues)
- Discussions: [GitHub Discussions](https://github.com/your-org/phoenix-7742/discussions)