#!/usr/bin/env node
/**
 * PHOENIX-7742 Containerized Browser Automation Worker
 * 
 * Main worker process that connects to Redis + BullMQ queue system
 * and executes browser automation tasks using Playwright
 */

import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { BrowserEngine } from './browser-engine.js';
import { QueueConsumer } from './queue-consumer.js';
import { WorkerManager } from './worker-manager.js';
import { createServer } from 'http';
import { performance } from 'perf_hooks';

// Environment configuration
const config = {
  workerId: process.env.WORKER_ID || `worker-${Math.random().toString(36).substr(2, 9)}`,
  redisUrl: process.env.REDIS_URL || null, // ✅ Allow null for development mode
  maxConcurrentTasks: parseInt(process.env.MAX_CONCURRENT_TASKS || '3'),
  taskTimeout: parseInt(process.env.TASK_TIMEOUT || '300000'), // 5 minutes
  browserType: process.env.BROWSER_TYPE as 'chromium' | 'firefox' | 'webkit' || 'chromium',
  headless: process.env.HEADLESS !== 'false',
  healthCheckPort: parseInt(process.env.HEALTH_CHECK_PORT || '3001'),
  gracefulShutdownTimeout: parseInt(process.env.GRACEFUL_SHUTDOWN_TIMEOUT || '30000'),
  resourceMonitoringInterval: parseInt(process.env.RESOURCE_MONITORING_INTERVAL || '30000'), // 30 seconds
};

class ContainerWorker {
  private redis: Redis;
  private browserEngine: BrowserEngine;
  private queueConsumer: QueueConsumer;
  private workerManager: WorkerManager;
  private healthServer: any;
  private isShuttingDown = false;
  private startTime = performance.now();
  private stats = {
    tasksProcessed: 0,
    tasksSucceeded: 0,
    tasksFailed: 0,
    browsersLaunched: 0,
    lastTaskTime: 0,
  };

  constructor() {
    this.log('🚀 PHOENIX-7742 Worker initializing...', { workerId: config.workerId });
    
    // ✅ DEV MODE: Skip Redis in development, connect to server's in-memory queue
    if (config.redisUrl) {
      try {
        // Test Redis connection first
        const testRedis = new Redis(config.redisUrl, {
          lazyConnect: true,
          connectTimeout: 5000,
          commandTimeout: 3000,
        });
        
        // Don't await the ping here - delay the test until start() method
        testRedis.disconnect();
        
        // Initialize Redis connection for production only if not in development
        this.redis = new Redis(config.redisUrl, {
          maxRetriesPerRequest: 3,
          lazyConnect: true,
          keepAlive: 30000,
          connectTimeout: 10000,
          commandTimeout: 5000,
        });
        
        this.log('🔌 Redis client initialized (will test connection on start)');
      } catch (error) {
        this.log('❌ WORKER: Redis initialization failed, falling back to development mode', { error: error instanceof Error ? error.message : error });
        this.redis = null as any;
      }
    } else {
      // Development mode - no Redis needed
      this.log('💡 DEV MODE: Running without Redis, will connect to server queue');
      this.redis = null as any; // Skip Redis in development
    }

    // Initialize core components
    this.browserEngine = new BrowserEngine(config);
    this.workerManager = new WorkerManager(config);
    this.queueConsumer = new QueueConsumer(this.redis, this.browserEngine, this.workerManager, config);

    // Setup event handlers
    this.setupEventHandlers();
    this.setupHealthCheck();
  }

  /**
   * Start the worker process
   */
  async start(): Promise<void> {
    try {
      // ✅ DEV MODE: Skip Redis connection in development
      if (config.redisUrl && this.redis) {
        try {
          this.log('🔌 Testing Redis connection...', { url: this.maskRedisUrl(config.redisUrl) });
          await this.redis.ping();
          this.log('✅ Redis connection test successful');
          this.log('🔌 Connecting to Redis...', { url: this.maskRedisUrl(config.redisUrl) });
          await this.redis.connect();
          this.log('✅ Redis connection established');
        } catch (error) {
          this.log('❌ WORKER: Redis connection failed, falling back to development mode', { error: error instanceof Error ? error.message : error });
          if (this.redis) {
            this.redis.disconnect();
          }
          this.redis = null as any;
        }
      } else {
        this.log('💡 DEV MODE: Skipping Redis - will process tasks directly from server');
      }

      this.log('🌐 Initializing browser engine...');
      await this.browserEngine.initialize();
      this.log('✅ Browser engine ready', { browserType: config.browserType });

      this.log('⚡ Starting queue consumer...');
      await this.queueConsumer.start();
      this.log('✅ Queue consumer active', { maxConcurrent: config.maxConcurrentTasks });

      this.log('💪 Starting worker manager...');
      await this.workerManager.start();
      this.log('✅ Worker manager active');

      this.log('🏥 Starting health check server...');
      await this.startHealthServer();
      this.log('✅ Health check server running', { port: config.healthCheckPort });

      this.log('🎯 PHOENIX-7742 Worker fully operational!', {
        workerId: config.workerId,
        uptime: this.getUptime(),
        config: {
          maxConcurrentTasks: config.maxConcurrentTasks,
          taskTimeout: config.taskTimeout,
          browserType: config.browserType,
          headless: config.headless,
        }
      });

      // Keep the process alive
      this.setupKeepAlive();
      
    } catch (error) {
      this.log('❌ Failed to start worker:', error);
      await this.shutdown(1);
    }
  }

  /**
   * Setup event handlers for graceful shutdown and monitoring
   */
  private setupEventHandlers(): void {
    // Handle graceful shutdown signals
    process.on('SIGTERM', () => this.handleShutdownSignal('SIGTERM'));
    process.on('SIGINT', () => this.handleShutdownSignal('SIGINT'));
    process.on('SIGHUP', () => this.handleShutdownSignal('SIGHUP'));

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      this.log('💥 Uncaught exception:', error);
      this.shutdown(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      this.log('🚨 Unhandled rejection:', { reason, promise });
      this.shutdown(1);
    });

    // Redis connection events
    this.redis.on('connect', () => this.log('🔌 Redis connected'));
    this.redis.on('ready', () => this.log('✅ Redis ready'));
    this.redis.on('error', (error) => this.log('❌ Redis error:', error));
    this.redis.on('close', () => this.log('🔌 Redis connection closed'));
    this.redis.on('reconnecting', () => this.log('🔄 Redis reconnecting...'));

    // Task processing events
    this.queueConsumer.on('taskStarted', (taskId) => {
      this.stats.tasksProcessed++;
      this.stats.lastTaskTime = performance.now();
      this.log('⚡ Task started', { taskId, stats: this.getStats() });
    });

    this.queueConsumer.on('taskCompleted', (taskId, result) => {
      this.stats.tasksSucceeded++;
      this.log('✅ Task completed', { taskId, duration: this.getTaskDuration(), result });
    });

    this.queueConsumer.on('taskFailed', (taskId, error) => {
      this.stats.tasksFailed++;
      this.log('❌ Task failed', { taskId, duration: this.getTaskDuration(), error: error.message });
    });

    // Browser events
    this.browserEngine.on('browserLaunched', (browserId) => {
      this.stats.browsersLaunched++;
      this.log('🌐 Browser launched', { browserId, total: this.stats.browsersLaunched });
    });

    this.browserEngine.on('browserClosed', (browserId) => {
      this.log('🔒 Browser closed', { browserId });
    });
  }

  /**
   * Setup health check HTTP server
   */
  private setupHealthCheck(): void {
    this.healthServer = createServer((req, res) => {
      if (req.url === '/health' && req.method === 'GET') {
        const health = {
          status: this.isShuttingDown ? 'shutting_down' : 'healthy',
          workerId: config.workerId,
          uptime: this.getUptime(),
          stats: this.getStats(),
          timestamp: new Date().toISOString(),
          version: process.env.npm_package_version || '1.0.0',
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(health, null, 2));
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    this.healthServer.on('error', (error: any) => {
      this.log('❌ Health server error:', error);
    });
  }

  /**
   * Start the health check server
   */
  private async startHealthServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.healthServer.listen(config.healthCheckPort, '0.0.0.0', (error: any) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Handle shutdown signals gracefully
   */
  private async handleShutdownSignal(signal: string): Promise<void> {
    if (this.isShuttingDown) {
      this.log('🚨 Force shutdown - second signal received');
      process.exit(1);
    }

    this.log(`🛑 Received ${signal} - initiating graceful shutdown...`);
    await this.shutdown(0);
  }

  /**
   * Gracefully shutdown the worker
   */
  private async shutdown(exitCode: number): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    const shutdownStart = performance.now();
    this.log('🛑 Starting graceful shutdown...', { 
      exitCode,
      uptime: this.getUptime(),
      finalStats: this.getStats()
    });

    try {
      // Set shutdown timeout
      const shutdownTimeout = setTimeout(() => {
        this.log('⏰ Graceful shutdown timeout - forcing exit');
        process.exit(1);
      }, config.gracefulShutdownTimeout);

      // Stop accepting new tasks
      this.log('⏹️ Stopping queue consumer...');
      await this.queueConsumer.stop();

      // Wait for current tasks to complete
      this.log('⏳ Waiting for current tasks to complete...');
      await this.workerManager.waitForTasksToComplete();

      // Cleanup browser resources
      this.log('🌐 Cleaning up browser resources...');
      await this.browserEngine.cleanup();

      // Close Redis connection
      this.log('🔌 Closing Redis connection...');
      await this.redis.quit();

      // Close health server
      this.log('🏥 Closing health server...');
      this.healthServer?.close();

      clearTimeout(shutdownTimeout);

      const shutdownDuration = performance.now() - shutdownStart;
      this.log('✅ Graceful shutdown completed', { 
        duration: `${shutdownDuration.toFixed(2)}ms`,
        exitCode 
      });

    } catch (error) {
      this.log('❌ Error during shutdown:', error);
      exitCode = 1;
    }

    process.exit(exitCode);
  }

  /**
   * Setup keep-alive mechanism
   */
  private setupKeepAlive(): void {
    // Log periodic status updates
    setInterval(() => {
      this.log('💓 Worker heartbeat', {
        workerId: config.workerId,
        uptime: this.getUptime(),
        stats: this.getStats(),
        memoryUsage: process.memoryUsage(),
      });
    }, 60000); // Every minute
  }

  /**
   * Utility methods
   */
  private log(message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      workerId: config.workerId,
      message,
      ...(data && { data }),
    };
    console.log(JSON.stringify(logEntry));
  }

  private maskRedisUrl(url: string): string {
    return url.replace(/redis:\/\/[^@]*@/, 'redis://***:***@');
  }

  private getUptime(): string {
    const uptimeMs = performance.now() - this.startTime;
    const seconds = Math.floor(uptimeMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  private getStats() {
    return {
      ...this.stats,
      successRate: this.stats.tasksProcessed > 0 
        ? `${((this.stats.tasksSucceeded / this.stats.tasksProcessed) * 100).toFixed(1)}%`
        : '0%',
    };
  }

  private getTaskDuration(): string {
    if (this.stats.lastTaskTime === 0) return '0ms';
    const duration = performance.now() - this.stats.lastTaskTime;
    return `${duration.toFixed(2)}ms`;
  }
}

// Start the worker if this is the main module
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const worker = new ContainerWorker();
  worker.start().catch((error) => {
    console.error('Failed to start worker:', error);
    process.exit(1);
  });
}

export { ContainerWorker };