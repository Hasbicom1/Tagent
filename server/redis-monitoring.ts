/**
 * REDIS MONITORING SERVICE
 * 
 * Provides comprehensive Redis monitoring, health checks, and alerting
 * for production Railway deployment.
 */

import { Redis } from 'ioredis';
import { logger } from './logger';

interface RedisMetrics {
  connectionStatus: 'connected' | 'disconnected' | 'error';
  lastPing: number;
  responseTime: number;
  memoryUsage: number;
  connectedClients: number;
  commandsProcessed: number;
  keyspaceHits: number;
  keyspaceMisses: number;
  uptime: number;
  errorCount: number;
  lastError?: string;
}

interface MonitoringConfig {
  healthCheckInterval: number;
  alertThreshold: {
    responseTime: number;
    errorRate: number;
    memoryUsage: number;
  };
  enableAlerts: boolean;
}

export class RedisMonitoringService {
  private redis: Redis;
  private metrics: RedisMetrics;
  private config: MonitoringConfig;
  private healthCheckTimer?: NodeJS.Timeout;
  private isMonitoring = false;

  constructor(redis: Redis, config?: Partial<MonitoringConfig>) {
    this.redis = redis;
    this.config = {
      healthCheckInterval: 30000, // 30 seconds
      alertThreshold: {
        responseTime: 1000, // 1 second
        errorRate: 0.05, // 5%
        memoryUsage: 0.8 // 80%
      },
      enableAlerts: true,
      ...config
    };

    this.metrics = {
      connectionStatus: 'disconnected',
      lastPing: 0,
      responseTime: 0,
      memoryUsage: 0,
      connectedClients: 0,
      commandsProcessed: 0,
      keyspaceHits: 0,
      keyspaceMisses: 0,
      uptime: 0,
      errorCount: 0
    };

    this.setupRedisEventListeners();
  }

  private setupRedisEventListeners(): void {
    this.redis.on('connect', () => {
      this.metrics.connectionStatus = 'connected';
      logger.info('✅ REDIS MONITOR: Connection established');
    });

    this.redis.on('error', (error) => {
      this.metrics.connectionStatus = 'error';
      this.metrics.errorCount++;
      this.metrics.lastError = error.message;
      logger.error('❌ REDIS MONITOR: Connection error', { error: error.message });
      
      if (this.config.enableAlerts) {
        this.sendAlert('Redis Connection Error', error.message);
      }
    });

    this.redis.on('close', () => {
      this.metrics.connectionStatus = 'disconnected';
      logger.warn('⚠️ REDIS MONITOR: Connection closed');
    });

    this.redis.on('reconnecting', () => {
      logger.info('🔄 REDIS MONITOR: Reconnecting...');
    });
  }

  public startMonitoring(): void {
    if (this.isMonitoring) {
      logger.warn('⚠️ REDIS MONITOR: Monitoring already started');
      return;
    }

    this.isMonitoring = true;
    logger.info('🚀 REDIS MONITOR: Starting Redis monitoring service');

    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthCheck();
    }, this.config.healthCheckInterval);

    // Initial health check
    this.performHealthCheck();
  }

  public stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }

    logger.info('🛑 REDIS MONITOR: Monitoring service stopped');
  }

  private async performHealthCheck(): Promise<void> {
    try {
      const startTime = Date.now();
      
      // Ping Redis to check connectivity
      await this.redis.ping();
      
      const responseTime = Date.now() - startTime;
      this.metrics.lastPing = Date.now();
      this.metrics.responseTime = responseTime;

      // Get Redis info
      const info = await this.redis.info();
      this.parseRedisInfo(info);

      // Check for alerts
      this.checkAlertThresholds();

      logger.debug('📊 REDIS MONITOR: Health check completed', {
        responseTime,
        connectionStatus: this.metrics.connectionStatus,
        memoryUsage: this.metrics.memoryUsage
      });

    } catch (error) {
      this.metrics.connectionStatus = 'error';
      this.metrics.errorCount++;
      this.metrics.lastError = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error('❌ REDIS MONITOR: Health check failed', { 
        error: error instanceof Error ? error.message : error 
      });

      if (this.config.enableAlerts) {
        this.sendAlert('Redis Health Check Failed', this.metrics.lastError);
      }
    }
  }

  private parseRedisInfo(info: string): void {
    const lines = info.split('\r\n');
    
    for (const line of lines) {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        
        switch (key) {
          case 'used_memory':
            this.metrics.memoryUsage = parseInt(value) || 0;
            break;
          case 'connected_clients':
            this.metrics.connectedClients = parseInt(value) || 0;
            break;
          case 'total_commands_processed':
            this.metrics.commandsProcessed = parseInt(value) || 0;
            break;
          case 'keyspace_hits':
            this.metrics.keyspaceHits = parseInt(value) || 0;
            break;
          case 'keyspace_misses':
            this.metrics.keyspaceMisses = parseInt(value) || 0;
            break;
          case 'uptime_in_seconds':
            this.metrics.uptime = parseInt(value) || 0;
            break;
        }
      }
    }
  }

  private checkAlertThresholds(): void {
    if (!this.config.enableAlerts) return;

    // Check response time
    if (this.metrics.responseTime > this.config.alertThreshold.responseTime) {
      this.sendAlert(
        'High Redis Response Time',
        `Response time: ${this.metrics.responseTime}ms (threshold: ${this.config.alertThreshold.responseTime}ms)`
      );
    }

    // Check error rate (simplified - could be more sophisticated)
    const totalCommands = this.metrics.keyspaceHits + this.metrics.keyspaceMisses;
    if (totalCommands > 0) {
      const errorRate = this.metrics.errorCount / totalCommands;
      if (errorRate > this.config.alertThreshold.errorRate) {
        this.sendAlert(
          'High Redis Error Rate',
          `Error rate: ${(errorRate * 100).toFixed(2)}% (threshold: ${(this.config.alertThreshold.errorRate * 100).toFixed(2)}%)`
        );
      }
    }
  }

  private sendAlert(title: string, message: string): void {
    logger.error(`🚨 REDIS ALERT: ${title}`, { message });
    
    // In production, you could integrate with:
    // - Slack webhooks
    // - Email notifications
    // - PagerDuty
    // - Discord webhooks
    // - Railway notifications
    
    console.error(`🚨 REDIS ALERT: ${title} - ${message}`);
  }

  public getMetrics(): RedisMetrics {
    return { ...this.metrics };
  }

  public getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    metrics: RedisMetrics;
    timestamp: number;
  } {
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (this.metrics.connectionStatus === 'error' || this.metrics.connectionStatus === 'disconnected') {
      status = 'unhealthy';
    } else if (
      this.metrics.responseTime > this.config.alertThreshold.responseTime ||
      this.metrics.errorCount > 10
    ) {
      status = 'degraded';
    }

    return {
      status,
      metrics: this.getMetrics(),
      timestamp: Date.now()
    };
  }

  public async testConnection(): Promise<boolean> {
    try {
      await this.redis.ping();
      return true;
    } catch (error) {
      logger.error('❌ REDIS MONITOR: Connection test failed', { 
        error: error instanceof Error ? error.message : error 
      });
      return false;
    }
  }
}

// Singleton instance for global use
let monitoringService: RedisMonitoringService | null = null;

export function initializeRedisMonitoring(redis: Redis, config?: Partial<MonitoringConfig>): RedisMonitoringService {
  if (monitoringService) {
    logger.warn('⚠️ REDIS MONITOR: Monitoring service already initialized');
    return monitoringService;
  }

  monitoringService = new RedisMonitoringService(redis, config);
  monitoringService.startMonitoring();
  
  logger.info('✅ REDIS MONITOR: Monitoring service initialized');
  return monitoringService;
}

export function getRedisMonitoring(): RedisMonitoringService | null {
  return monitoringService;
}

export function stopRedisMonitoring(): void {
  if (monitoringService) {
    monitoringService.stopMonitoring();
    monitoringService = null;
    logger.info('🛑 REDIS MONITOR: Monitoring service stopped and cleaned up');
  }
}