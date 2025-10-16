/**
 * PHOENIX-7742 Queue Consumer
 * 
 * BullMQ consumer that processes browser automation tasks
 * and integrates with the main application's queue system
 */

import { Worker, Job, Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { EventEmitter } from 'events';
import { BrowserEngine, BrowserTask, BrowserTaskResult } from './browser-engine.js';
import { WorkerManager } from './worker-manager.js';

// Task types from main application
enum TaskType {
  BROWSER_AUTOMATION = 'BROWSER_AUTOMATION',
  SESSION_START = 'SESSION_START',
  SESSION_END = 'SESSION_END'
}

// Task payloads
interface BrowserAutomationPayload {
  instruction: string;
  sessionId: string;
  agentId: string;
  url?: string;
  context?: Record<string, any>;
}

interface SessionStartPayload {
  agentId: string;
  sessionId: string;
  userMessage: string;
}

interface SessionEndPayload {
  agentId: string;
  sessionId: string;
  reason: string;
}

type TaskPayload = BrowserAutomationPayload | SessionStartPayload | SessionEndPayload;

interface ConsumerConfig {
  workerId: string;
  maxConcurrentTasks: number;
  taskTimeout: number;
}

export class QueueConsumer extends EventEmitter {
  private redis: Redis;
  private browserEngine: BrowserEngine;
  private workerManager: WorkerManager;
  private config: ConsumerConfig;
  private worker: Worker | null = null;
  private isRunning = false;
  private activeTasks = new Map<string, Job>();

  constructor(
    redis: Redis,
    browserEngine: BrowserEngine,
    workerManager: WorkerManager,
    config: ConsumerConfig
  ) {
    super();
    this.redis = redis;
    this.browserEngine = browserEngine;
    this.workerManager = workerManager;
    this.config = config;
  }

  /**
   * Start the queue consumer
   */
  async start(): Promise<void> {
    if (this.isRunning) return;

    try {
      this.log('🚀 Starting queue consumer...', { workerId: this.config.workerId });

      // Check if Redis is available (production mode)
      if (this.redis) {
        // Create BullMQ worker for consuming tasks
        this.worker = new Worker(
          'browser-automation', // Align with producer queue name
          this.processJob.bind(this),
          {
            connection: this.redis,
            concurrency: this.config.maxConcurrentTasks,
            removeOnComplete: { count: 100 },
            removeOnFail: { count: 50 },
          }
        );

        // Setup worker event handlers
        this.setupWorkerEvents();
        this.log('✅ Queue consumer started with Redis connection', {
          queueName: 'browser-automation',
          hasPassword: !!(process.env.REDIS_PASSWORD || process.env.RAILWAY_REDIS_PASSWORD),
          hasUsername: !!(process.env.REDIS_USERNAME || process.env.RAILWAY_REDIS_USERNAME),
        });
      } else {
        // Development mode - no Redis, no BullMQ worker
        this.log('💡 DEV MODE: Queue consumer started without Redis (development mode)');
        this.log('📝 In development mode, tasks will be processed via direct API calls');
      }

      this.isRunning = true;
      this.log('✅ Queue consumer started successfully');

    } catch (error) {
      this.log('❌ Failed to start queue consumer:', error);
      throw error;
    }
  }

  /**
   * Stop the queue consumer
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.log('🛑 Stopping queue consumer...');
    this.isRunning = false;

    try {
      // Wait for active tasks to complete
      if (this.activeTasks.size > 0) {
        this.log('⏳ Waiting for active tasks to complete...', { 
          activeTaskCount: this.activeTasks.size 
        });
        
        const waitPromise = new Promise<void>((resolve) => {
          const checkInterval = setInterval(() => {
            if (this.activeTasks.size === 0) {
              clearInterval(checkInterval);
              resolve();
            }
          }, 1000);
        });

        // Wait up to 30 seconds for tasks to complete
        await Promise.race([
          waitPromise,
          new Promise(resolve => setTimeout(resolve, 30000))
        ]);
      }

      // Close worker
      if (this.worker) {
        await this.worker.close();
        this.worker = null;
      }

      // Progress updates handled via Redis pub/sub only - no queue to close

      this.log('✅ Queue consumer stopped');

    } catch (error) {
      this.log('❌ Error stopping queue consumer:', error);
      throw error;
    }
  }

  /**
   * Process individual job from queue
   */
  private async processJob(job: Job): Promise<any> {
    const { type, payload } = job.data as { type: TaskType; payload: TaskPayload };
    
    this.log('⚡ Processing job', { 
      jobId: job.id, 
      type, 
      workerId: this.config.workerId 
    });

    // Track active task
    this.activeTasks.set(job.id!, job);
    this.emit('taskStarted', job.id);

    try {
      let result: any;

      switch (type) {
        case TaskType.BROWSER_AUTOMATION:
          result = await this.processBrowserAutomationJob(job);
          break;
          
        case TaskType.SESSION_START:
          result = await this.processSessionStartJob(job);
          break;
          
        case TaskType.SESSION_END:
          result = await this.processSessionEndJob(job);
          break;
          
        default:
          throw new Error(`Unknown task type: ${type}`);
      }

      // Remove from active tasks
      this.activeTasks.delete(job.id!);
      this.emit('taskCompleted', job.id, result);

      return result;

    } catch (error) {
      // Remove from active tasks
      this.activeTasks.delete(job.id!);
      this.emit('taskFailed', job.id, error);
      throw error;
    }
  }

  /**
   * Process browser automation job
   */
  private async processBrowserAutomationJob(job: Job): Promise<BrowserTaskResult> {
    const payload = job.data.payload as BrowserAutomationPayload;
    
    try {
      // Send initial progress update
      await this.sendProgressUpdate(job, 10, 'Initializing browser automation', [
        'Setting up browser context...',
        'Loading automation engine...'
      ]);

      // Create browser task
      const browserTask: BrowserTask = {
        id: job.id!,
        sessionId: payload.sessionId,
        instruction: payload.instruction,
        url: payload.url,
        context: payload.context,
        timeout: this.config.taskTimeout,
      };

      // Send task creation update
      await this.sendProgressUpdate(job, 25, 'Creating automation task', [
        `Task: "${payload.instruction}"`,
        'Analyzing target environment...'
      ]);

      // Execute browser automation
      await this.sendProgressUpdate(job, 50, 'Executing automation sequence', [
        'Browser automation in progress...',
        'Processing user instructions...'
      ]);

      const result = await this.browserEngine.executeTask(browserTask);

      // Send completion update
      if (result.success) {
        await this.sendProgressUpdate(job, 100, 'Task completed successfully', [
          'Automation sequence completed',
          'Processing results...',
          `Executed ${result.steps.length} steps`
        ]);
      } else {
        await this.sendProgressUpdate(job, 0, 'Task execution failed', [
          `Error: ${result.error}`,
          'Automation sequence terminated'
        ]);
      }

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      await this.sendProgressUpdate(job, 0, 'Task execution error', [
        `Error: ${errorMessage}`,
        'Browser automation terminated unexpectedly'
      ]);

      throw error;
    }
  }

  /**
   * Process session start job
   */
  private async processSessionStartJob(job: Job): Promise<any> {
    const payload = job.data.payload as SessionStartPayload;
    
    this.log('🚀 Processing session start', { 
      sessionId: payload.sessionId, 
      agentId: payload.agentId 
    });

    // Perform session initialization
    // This could include warming up browser, setting up context, etc.
    
    return {
      success: true,
      message: `Session ${payload.sessionId} started successfully`,
      agentId: payload.agentId,
      sessionId: payload.sessionId,
      workerId: this.config.workerId,
    };
  }

  /**
   * Process session end job
   */
  private async processSessionEndJob(job: Job): Promise<any> {
    const payload = job.data.payload as SessionEndPayload;
    
    this.log('📴 Processing session end', { 
      sessionId: payload.sessionId, 
      agentId: payload.agentId,
      reason: payload.reason 
    });

    // Perform session cleanup
    // This could include closing browsers, cleaning up resources, etc.
    
    return {
      success: true,
      message: `Session ${payload.sessionId} ended successfully`,
      agentId: payload.agentId,
      sessionId: payload.sessionId,
      reason: payload.reason,
      workerId: this.config.workerId,
    };
  }

  /**
   * Send progress update to main application
   */
  private async sendProgressUpdate(
    job: Job, 
    progress: number, 
    stage: string, 
    logs: string[]
  ): Promise<void> {
    try {
      // Update job progress
      await job.updateProgress(progress);

      // Send detailed progress through Redis pub/sub (for WebSocket broadcasting)
      if (this.redis) {
        const progressMessage = {
          type: 'task_progress',
          jobId: job.id,
          workerId: this.config.workerId,
          progress,
          stage,
          logs,
          timestamp: new Date().toISOString(),
        };

        await this.redis.publish('ws:broadcast', JSON.stringify({
          type: 'task_progress',
          data: progressMessage,
        }));
      }

    } catch (error) {
      this.log('⚠️ Failed to send progress update:', error);
    }
  }

  /**
   * Setup worker event handlers
   */
  private setupWorkerEvents(): void {
    if (!this.worker) return;

    this.worker.on('completed', (job) => {
      this.log('✅ Job completed', { 
        jobId: job.id, 
        duration: job.finishedOn ? job.finishedOn - job.processedOn! : 'unknown'
      });
    });

    this.worker.on('failed', (job, error) => {
      this.log('❌ Job failed', { 
        jobId: job?.id, 
        error: error.message 
      });
    });

    this.worker.on('active', (job) => {
      this.log('⚡ Job started', { 
        jobId: job.id,
        workerId: this.config.workerId 
      });
    });

    this.worker.on('stalled', (jobId) => {
      this.log('⏰ Job stalled', { jobId });
    });

    this.worker.on('progress', (job, progress) => {
      this.log('📈 Job progress', { 
        jobId: job.id, 
        progress: `${progress}%` 
      });
    });

    this.worker.on('error', (error) => {
      this.log('💥 Worker error:', error);
    });

    this.worker.on('closing', () => {
      this.log('🔒 Worker closing...');
    });

    this.worker.on('closed', () => {
      this.log('🔒 Worker closed');
    });
  }

  /**
   * Get active task count
   */
  getActiveTaskCount(): number {
    return this.activeTasks.size;
  }

  /**
   * Get worker statistics
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      activeTaskCount: this.activeTasks.size,
      maxConcurrentTasks: this.config.maxConcurrentTasks,
      workerId: this.config.workerId,
    };
  }

  /**
   * Utility logging method
   */
  private log(message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      component: 'QueueConsumer',
      workerId: this.config.workerId,
      message,
      ...(data && { data }),
    };
    console.log(JSON.stringify(logEntry));
  }
}