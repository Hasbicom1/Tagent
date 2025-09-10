/**
 * PHOENIX-7742 Health Check
 * 
 * Health check utility for Docker container health monitoring
 */

import { createConnection } from 'net';
import { performance } from 'perf_hooks';

interface HealthCheckConfig {
  port: number;
  timeout: number;
  checkInterval: number;
}

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'starting';
  timestamp: string;
  uptime: number;
  checks: {
    redis: boolean;
    worker: boolean;
    browser: boolean;
    memory: boolean;
  };
  metrics: {
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
  };
  error?: string;
}

class HealthChecker {
  private config: HealthCheckConfig;
  private startTime = performance.now();

  constructor(config: Partial<HealthCheckConfig> = {}) {
    this.config = {
      port: parseInt(process.env.HEALTH_CHECK_PORT || '3001'),
      timeout: 5000,
      checkInterval: 30000,
      ...config,
    };
  }

  /**
   * Perform comprehensive health check
   */
  async checkHealth(): Promise<HealthStatus> {
    const startTime = performance.now();
    
    try {
      const checks = {
        redis: await this.checkRedisConnection(),
        worker: await this.checkWorkerStatus(),
        browser: await this.checkBrowserEngine(),
        memory: this.checkMemoryUsage(),
      };

      const allHealthy = Object.values(checks).every(check => check === true);
      
      const health: HealthStatus = {
        status: allHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: (performance.now() - this.startTime) / 1000,
        checks,
        metrics: {
          memoryUsage: process.memoryUsage(),
          cpuUsage: process.cpuUsage(),
        },
      };

      if (!allHealthy) {
        const failedChecks = Object.entries(checks)
          .filter(([_, status]) => !status)
          .map(([name]) => name);
        
        health.error = `Failed health checks: ${failedChecks.join(', ')}`;
      }

      const checkDuration = performance.now() - startTime;
      this.log('🏥 Health check completed', { 
        status: health.status,
        duration: `${checkDuration.toFixed(2)}ms`,
        checks,
      });

      return health;

    } catch (error) {
      const checkDuration = performance.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.log('❌ Health check failed', { 
        error: errorMessage,
        duration: `${checkDuration.toFixed(2)}ms` 
      });

      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: (performance.now() - this.startTime) / 1000,
        checks: {
          redis: false,
          worker: false,
          browser: false,
          memory: false,
        },
        metrics: {
          memoryUsage: process.memoryUsage(),
          cpuUsage: process.cpuUsage(),
        },
        error: errorMessage,
      };
    }
  }

  /**
   * Check Redis connection
   */
  private async checkRedisConnection(): Promise<boolean> {
    try {
      const redisUrl = process.env.REDIS_URL;
      if (!redisUrl) {
        // In development mode without Redis, this is acceptable
        return process.env.NODE_ENV === 'development';
      }

      // Parse Redis URL to get host and port
      const url = new URL(redisUrl);
      const host = url.hostname || 'localhost';
      const port = parseInt(url.port) || 6379;

      return new Promise<boolean>((resolve) => {
        const socket = createConnection({ host, port });
        
        const cleanup = () => {
          socket.removeAllListeners();
          socket.destroy();
        };

        const timeout = setTimeout(() => {
          cleanup();
          resolve(false);
        }, this.config.timeout);

        socket.on('connect', () => {
          clearTimeout(timeout);
          cleanup();
          resolve(true);
        });

        socket.on('error', () => {
          clearTimeout(timeout);
          cleanup();
          resolve(false);
        });
      });

    } catch (error) {
      this.log('❌ Redis health check error:', error);
      return false;
    }
  }

  /**
   * Check worker status
   */
  private async checkWorkerStatus(): Promise<boolean> {
    try {
      // Check if worker processes are running by looking for specific environment variables
      const workerId = process.env.WORKER_ID;
      const hasRequiredEnvVars = workerId !== undefined;
      
      // Check if the main worker process is responsive
      // In a more complex setup, this could check actual worker queues
      return hasRequiredEnvVars && process.uptime() > 10; // At least 10 seconds uptime

    } catch (error) {
      this.log('❌ Worker status check error:', error);
      return false;
    }
  }

  /**
   * Check browser engine status
   */
  private async checkBrowserEngine(): Promise<boolean> {
    try {
      // Check if Playwright binaries are available
      const { chromium } = await import('playwright');
      
      // Quick test to ensure browser can be instantiated
      // This doesn't actually launch a browser to keep the check lightweight
      const executablePath = chromium.executablePath();
      return executablePath !== null && executablePath !== undefined;

    } catch (error) {
      this.log('❌ Browser engine check error:', error);
      return false;
    }
  }

  /**
   * Check memory usage
   */
  private checkMemoryUsage(): boolean {
    try {
      const usage = process.memoryUsage();
      const heapUsedMB = usage.heapUsed / 1024 / 1024;
      const rssUsedMB = usage.rss / 1024 / 1024;

      // Consider unhealthy if heap usage > 1GB or RSS > 2GB
      const isHeapHealthy = heapUsedMB < 1024;
      const isRssHealthy = rssUsedMB < 2048;

      if (!isHeapHealthy || !isRssHealthy) {
        this.log('⚠️ High memory usage detected', { 
          heapUsed: `${heapUsedMB.toFixed(2)}MB`,
          rssUsed: `${rssUsedMB.toFixed(2)}MB` 
        });
      }

      return isHeapHealthy && isRssHealthy;

    } catch (error) {
      this.log('❌ Memory usage check error:', error);
      return false;
    }
  }

  /**
   * Run health check and exit with appropriate code
   */
  async runHealthCheck(): Promise<void> {
    try {
      const health = await this.checkHealth();
      
      if (health.status === 'healthy') {
        console.log(JSON.stringify(health, null, 2));
        process.exit(0);
      } else {
        console.error(JSON.stringify(health, null, 2));
        process.exit(1);
      }

    } catch (error) {
      console.error('Health check failed:', error);
      process.exit(1);
    }
  }

  /**
   * Utility logging method
   */
  private log(message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      component: 'HealthChecker',
      message,
      ...(data && { data }),
    };
    console.log(JSON.stringify(logEntry));
  }
}

// Run health check if this is the main module
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const checker = new HealthChecker();
  checker.runHealthCheck();
}

export { HealthChecker };