/**
 * PHOENIX-7742 Worker Manager
 * 
 * Manages worker processes, monitors health, and handles resource optimization
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { cpus, freemem, totalmem } from 'os';

interface WorkerConfig {
  workerId: string;
  maxConcurrentTasks: number;
  taskTimeout: number;
  resourceMonitoringInterval: number;
}

interface ResourceMetrics {
  timestamp: Date;
  cpuUsage: number;
  memoryUsage: {
    used: number;
    free: number;
    total: number;
    percentage: number;
  };
  activeProcesses: number;
  uptime: number;
}

interface TaskMetrics {
  id: string;
  startTime: number;
  status: 'running' | 'completed' | 'failed';
  duration?: number;
  resourceUsage?: ResourceMetrics;
}

export class WorkerManager extends EventEmitter {
  private config: WorkerConfig;
  private isRunning = false;
  private startTime = performance.now();
  private activeTasks = new Map<string, TaskMetrics>();
  private resourceMonitorInterval: NodeJS.Timeout | null = null;
  private lastResourceMetrics: ResourceMetrics | null = null;

  // Performance tracking
  private stats = {
    tasksStarted: 0,
    tasksCompleted: 0,
    tasksFailed: 0,
    totalExecutionTime: 0,
    avgExecutionTime: 0,
    peakMemoryUsage: 0,
    peakCpuUsage: 0,
  };

  constructor(config: WorkerConfig) {
    super();
    this.config = config;
  }

  /**
   * Start the worker manager
   */
  async start(): Promise<void> {
    if (this.isRunning) return;

    this.log('🚀 Starting worker manager...', { workerId: this.config.workerId });

    try {
      // Start resource monitoring
      this.startResourceMonitoring();

      // Setup process monitoring
      this.setupProcessMonitoring();

      this.isRunning = true;
      this.log('✅ Worker manager started successfully');

    } catch (error) {
      this.log('❌ Failed to start worker manager:', error);
      throw error;
    }
  }

  /**
   * Stop the worker manager
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.log('🛑 Stopping worker manager...');
    this.isRunning = false;

    try {
      // Stop resource monitoring
      if (this.resourceMonitorInterval) {
        clearInterval(this.resourceMonitorInterval);
        this.resourceMonitorInterval = null;
      }

      this.log('✅ Worker manager stopped');

    } catch (error) {
      this.log('❌ Error stopping worker manager:', error);
      throw error;
    }
  }

  /**
   * Register a new task
   */
  registerTask(taskId: string): void {
    const task: TaskMetrics = {
      id: taskId,
      startTime: performance.now(),
      status: 'running',
    };

    this.activeTasks.set(taskId, task);
    this.stats.tasksStarted++;

    this.log('📋 Task registered', { 
      taskId, 
      activeTaskCount: this.activeTasks.size,
      totalStarted: this.stats.tasksStarted 
    });

    this.emit('taskRegistered', taskId);
  }

  /**
   * Mark task as completed
   */
  completeTask(taskId: string, success: boolean = true): void {
    const task = this.activeTasks.get(taskId);
    if (!task) {
      this.log('⚠️ Attempted to complete unknown task', { taskId });
      return;
    }

    const duration = performance.now() - task.startTime;
    task.duration = duration;
    task.status = success ? 'completed' : 'failed';
    task.resourceUsage = this.lastResourceMetrics || undefined;

    // Update statistics
    if (success) {
      this.stats.tasksCompleted++;
    } else {
      this.stats.tasksFailed++;
    }

    this.stats.totalExecutionTime += duration;
    this.stats.avgExecutionTime = this.stats.totalExecutionTime / (this.stats.tasksCompleted + this.stats.tasksFailed);

    this.activeTasks.delete(taskId);

    this.log('✅ Task completed', { 
      taskId, 
      success,
      duration: `${duration.toFixed(2)}ms`,
      activeTaskCount: this.activeTasks.size,
      avgExecutionTime: `${this.stats.avgExecutionTime.toFixed(2)}ms`
    });

    this.emit('taskCompleted', taskId, success, duration);
  }

  /**
   * Check if worker can accept new tasks
   */
  canAcceptTask(): boolean {
    const canAccept = this.activeTasks.size < this.config.maxConcurrentTasks && this.isHealthy();
    
    if (!canAccept) {
      this.log('🚫 Cannot accept task', {
        activeTasks: this.activeTasks.size,
        maxConcurrent: this.config.maxConcurrentTasks,
        isHealthy: this.isHealthy(),
        resourceMetrics: this.lastResourceMetrics,
      });
    }

    return canAccept;
  }

  /**
   * Check worker health status
   */
  isHealthy(): boolean {
    if (!this.lastResourceMetrics) return true;

    const { memoryUsage, cpuUsage } = this.lastResourceMetrics;
    
    // Consider unhealthy if memory usage > 90% or CPU > 95%
    const isMemoryHealthy = memoryUsage.percentage < 90;
    const isCpuHealthy = cpuUsage < 95;
    
    return isMemoryHealthy && isCpuHealthy;
  }

  /**
   * Wait for all active tasks to complete
   */
  async waitForTasksToComplete(timeoutMs: number = 30000): Promise<void> {
    if (this.activeTasks.size === 0) return;

    this.log('⏳ Waiting for tasks to complete...', { 
      activeTaskCount: this.activeTasks.size,
      timeout: `${timeoutMs}ms` 
    });

    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        if (this.activeTasks.size === 0) {
          clearInterval(checkInterval);
          clearTimeout(timeout);
          this.log('✅ All tasks completed');
          resolve();
        }
      }, 1000);

      const timeout = setTimeout(() => {
        clearInterval(checkInterval);
        const remainingTasks = Array.from(this.activeTasks.keys());
        this.log('⏰ Task completion timeout', { 
          remainingTasks,
          count: remainingTasks.length 
        });
        reject(new Error(`Timeout waiting for ${remainingTasks.length} tasks to complete`));
      }, timeoutMs);
    });
  }

  /**
   * Get current worker statistics
   */
  getStats() {
    const uptime = performance.now() - this.startTime;
    
    return {
      workerId: this.config.workerId,
      isRunning: this.isRunning,
      isHealthy: this.isHealthy(),
      uptime: `${(uptime / 1000).toFixed(2)}s`,
      activeTasks: this.activeTasks.size,
      maxConcurrentTasks: this.config.maxConcurrentTasks,
      stats: {
        ...this.stats,
        avgExecutionTime: `${this.stats.avgExecutionTime.toFixed(2)}ms`,
        totalExecutionTime: `${this.stats.totalExecutionTime.toFixed(2)}ms`,
        successRate: this.stats.tasksStarted > 0 
          ? `${((this.stats.tasksCompleted / this.stats.tasksStarted) * 100).toFixed(1)}%`
          : '0%',
      },
      resourceMetrics: this.lastResourceMetrics,
    };
  }

  /**
   * Start resource monitoring
   */
  private startResourceMonitoring(): void {
    this.collectResourceMetrics(); // Initial collection
    
    this.resourceMonitorInterval = setInterval(() => {
      this.collectResourceMetrics();
    }, this.config.resourceMonitoringInterval);
  }

  /**
   * Collect current resource metrics
   */
  private collectResourceMetrics(): void {
    try {
      const memUsed = totalmem() - freemem();
      const memTotal = totalmem();
      const memFree = freemem();
      const memPercentage = (memUsed / memTotal) * 100;

      // Get CPU usage (simplified - in production, consider using more sophisticated monitoring)
      const cpuCount = cpus().length;
      const loadAvg = process.cpuUsage();
      const cpuUsage = ((loadAvg.user + loadAvg.system) / 1000000) * 100 / cpuCount;

      const metrics: ResourceMetrics = {
        timestamp: new Date(),
        cpuUsage: Math.min(cpuUsage, 100), // Cap at 100%
        memoryUsage: {
          used: memUsed,
          free: memFree,
          total: memTotal,
          percentage: memPercentage,
        },
        activeProcesses: this.activeTasks.size,
        uptime: (performance.now() - this.startTime) / 1000,
      };

      // Update peak values
      this.stats.peakMemoryUsage = Math.max(this.stats.peakMemoryUsage, memPercentage);
      this.stats.peakCpuUsage = Math.max(this.stats.peakCpuUsage, metrics.cpuUsage);

      this.lastResourceMetrics = metrics;

      // Emit warning if resources are high
      if (memPercentage > 80 || metrics.cpuUsage > 80) {
        this.log('⚠️ High resource usage detected', { 
          memoryUsage: `${memPercentage.toFixed(1)}%`,
          cpuUsage: `${metrics.cpuUsage.toFixed(1)}%`,
          activeTasks: this.activeTasks.size 
        });
        
        this.emit('highResourceUsage', metrics);
      }

    } catch (error) {
      this.log('❌ Error collecting resource metrics:', error);
    }
  }

  /**
   * Setup process monitoring
   */
  private setupProcessMonitoring(): void {
    // Monitor for memory leaks
    setInterval(() => {
      const memUsage = process.memoryUsage();
      const heapUsed = memUsage.heapUsed / 1024 / 1024; // MB
      
      if (heapUsed > 500) { // 500MB threshold
        this.log('⚠️ High heap usage detected', { 
          heapUsed: `${heapUsed.toFixed(2)}MB`,
          heapTotal: `${(memUsage.heapTotal / 1024 / 1024).toFixed(2)}MB`,
          external: `${(memUsage.external / 1024 / 1024).toFixed(2)}MB`,
        });
        
        this.emit('memoryWarning', memUsage);
      }
    }, 60000); // Check every minute

    // Monitor for long-running tasks
    setInterval(() => {
      const now = performance.now();
      const longRunningTasks = Array.from(this.activeTasks.entries())
        .filter(([_, task]) => (now - task.startTime) > this.config.taskTimeout)
        .map(([id, task]) => ({
          id,
          duration: now - task.startTime,
        }));

      if (longRunningTasks.length > 0) {
        this.log('⏰ Long-running tasks detected', { 
          tasks: longRunningTasks.map(t => ({
            id: t.id,
            duration: `${(t.duration / 1000).toFixed(2)}s`
          }))
        });
        
        this.emit('longRunningTasks', longRunningTasks);
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Force cleanup of stuck tasks
   */
  async forceCleanupStuckTasks(): Promise<void> {
    const now = performance.now();
    const stuckTaskTimeout = this.config.taskTimeout * 2; // Double the normal timeout
    
    const stuckTasks = Array.from(this.activeTasks.entries())
      .filter(([_, task]) => (now - task.startTime) > stuckTaskTimeout);

    if (stuckTasks.length > 0) {
      this.log('🧹 Force cleaning up stuck tasks', { 
        taskCount: stuckTasks.length,
        taskIds: stuckTasks.map(([id]) => id) 
      });

      for (const [taskId] of stuckTasks) {
        this.completeTask(taskId, false);
      }

      this.emit('stuckTasksCleanedUp', stuckTasks.length);
    }
  }

  /**
   * Utility logging method
   */
  private log(message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      component: 'WorkerManager',
      workerId: this.config.workerId,
      message,
      ...(data && { data }),
    };
    console.log(JSON.stringify(logEntry));
  }
}