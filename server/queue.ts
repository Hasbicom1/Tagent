import { Queue, Worker, Job, QueueEvents, ConnectionOptions, QueueOptions, QueueEventsOptions, WorkerOptions } from 'bullmq';
import { Redis } from 'ioredis';
import { Task, TaskResult, InsertTask, InsertTaskResult } from "@shared/schema";
import { storage } from './storage';
import { browserAgent } from './browserAutomation';
import { mcpOrchestrator } from './mcpOrchestrator';
import { wsManager } from './websocket';

// PRODUCTION OPTIMIZATION: Task batching for high-throughput scenarios
interface TaskBatch {
  tasks: Array<{ type: TaskType; payload: TaskPayload; priority: TaskPriority; delay?: number }>;
  batchId: string;
  createdAt: number;
}

const taskBatches = new Map<string, TaskBatch>();
let batchTimeout: NodeJS.Timeout | null = null;
const BATCH_SIZE = 5; // Process up to 5 tasks in a batch
const BATCH_TIMEOUT = 500; // Flush batch after 500ms

// Redis connection configuration with fallback for development
const getRedisConnection = async (): Promise<{ connection: ConnectionOptions } | undefined> => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const redisUrl = process.env.REDIS_URL;
  
  if (!redisUrl && isDevelopment) {
    console.log('⚡ QUEUE: Running in development mode - using in-memory fallback');
    return undefined; // Use in-memory fallback for development
  }
  
  if (!redisUrl) {
    if (isDevelopment) {
      console.log('⚡ QUEUE: No REDIS_URL in development - using in-memory fallback');
      return undefined;
    }
    throw new Error('REDIS_URL environment variable is required in production');
  }
  
  // Test Redis connection before returning configuration
  try {
    let testRedis: Redis;
    
    if (redisUrl.startsWith('redis://') || redisUrl.startsWith('rediss://')) {
      testRedis = new Redis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: null, // Required for BullMQ
        connectTimeout: 5000,
        commandTimeout: 3000,
      });
    } else {
      testRedis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0'),
        lazyConnect: true,
        maxRetriesPerRequest: null, // Required for BullMQ
        connectTimeout: 5000,
        commandTimeout: 3000,
      });
    }
    
    // Test the connection
    await testRedis.ping();
    console.log('✅ QUEUE: Redis connection test successful');
    
    // Close test connection
    testRedis.disconnect();
    
    // Return proper configuration for BullMQ
    if (redisUrl.startsWith('redis://') || redisUrl.startsWith('rediss://')) {
      return { 
        connection: new Redis(redisUrl, {
          maxRetriesPerRequest: null, // Required for BullMQ
          lazyConnect: true,
          connectTimeout: 10000,
          commandTimeout: 5000,
          enableAutoPipelining: true,
        })
      };
    }
    
    return {
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0'),
        maxRetriesPerRequest: null, // Required for BullMQ
        lazyConnect: true,
        connectTimeout: 10000,
        commandTimeout: 5000,
        enableAutoPipelining: true,
      }
    };
  } catch (error) {
    console.error('❌ QUEUE: Redis connection test failed:', error instanceof Error ? error.message : error);
    if (isDevelopment) {
      console.log('🔄 QUEUE: Falling back to in-memory mode for development');
      return undefined;
    }
    throw new Error(`Redis connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Task types and payload interfaces
export interface BrowserAutomationPayload {
  instruction: string;
  sessionId: string;
  agentId: string;
  url?: string;
  context?: Record<string, any>;
}

export interface SessionStartPayload {
  agentId: string;
  sessionId: string;
  userMessage: string;
}

export interface SessionEndPayload {
  agentId: string;
  sessionId: string;
  reason: string;
}

export type TaskPayload = BrowserAutomationPayload | SessionStartPayload | SessionEndPayload;

// Task priority levels
export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH'
}

// Task types
export enum TaskType {
  BROWSER_AUTOMATION = 'BROWSER_AUTOMATION',
  SESSION_START = 'SESSION_START',
  SESSION_END = 'SESSION_END'
}

// Task status
export enum TaskStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

// Queue configuration
const queueConfig = {
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
};

let agentQueue: Queue | null = null;
let agentWorker: Worker | null = null;
let queueEvents: QueueEvents | null = null;
let isInMemoryMode = false;

// In-memory task storage for development
interface InMemoryTask {
  id: string;
  data: TaskPayload;
  opts: any;
  status: TaskStatus;
  createdAt: Date;
  processedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  result?: any;
  error?: string;
}

const inMemoryTasks = new Map<string, InMemoryTask>();

// PRODUCTION OPTIMIZATION: Batched task processing for high throughput
async function processBatchedTasks(): Promise<void> {
  if (taskBatches.size === 0) return;
  
  console.log(`🚀 QUEUE: Processing ${taskBatches.size} task batches`);
  
  for (const [batchId, batch] of Array.from(taskBatches.entries())) {
    try {
      if (isInMemoryMode) {
        // Process batch in memory for development (avoid recursion)
        for (const task of batch.tasks) {
          const taskId = addInMemoryTask(task.type, task.payload, task.priority, task.delay);
          console.log(`📋 QUEUE: Processed batch task ${taskId} in memory`);
        }
      } else if (agentQueue) {
        // Add batch to Redis queue for production
        const jobs = batch.tasks.map(task => ({
          name: task.type,
          data: { type: task.type, payload: task.payload },
          opts: {
            priority: getPriorityValue(task.priority),
            delay: task.delay || 0,
            removeOnComplete: 100,
            removeOnFail: 50,
          }
        }));
        
        // PRODUCTION OPTIMIZATION: Add multiple jobs in a single Redis transaction
        const batchJobs = await agentQueue.addBulk(jobs);
        console.log(`✅ QUEUE: Batch ${batchId} added ${batch.tasks.length} tasks to queue`);
        
        // CRITICAL FIX: Update storage records with actual BullMQ job IDs for proper tracking
        for (let i = 0; i < batchJobs.length && i < batch.tasks.length; i++) {
          const job = batchJobs[i];
          const task = batch.tasks[i];
          const payload = task.payload;
          
          if (job.id) {
            try {
              // Create new storage record with the actual BullMQ job ID
              await storage.createTaskWithId(job.id, {
                sessionId: payload.sessionId,
                agentId: payload.agentId,
                type: task.type,
                status: TaskStatus.PENDING,
                payload: payload as any,
                priority: task.priority,
                attempts: "0",
                maxRetries: "3",
                scheduledAt: task.delay ? new Date(Date.now() + task.delay) : new Date(),
              });
              console.log(`🔗 QUEUE: Created storage record for BullMQ job ${job.id} (${task.type})`);
            } catch (mappingError) {
              console.error(`❌ QUEUE: Failed to create storage record for job ${job.id}:`, mappingError);
            }
          }
        }
      }
    } catch (error) {
      console.error(`❌ QUEUE: Failed to process batch ${batchId}:`, error);
    }
    
    taskBatches.delete(batchId);
  }
}

// PRODUCTION OPTIMIZATION: Schedule batch processing
function scheduleBatchProcessing(): void {
  if (batchTimeout) return;
  
  batchTimeout = setTimeout(async () => {
    await processBatchedTasks();
    batchTimeout = null;
  }, BATCH_TIMEOUT);
}

// Initialize queue system
export async function initializeQueue(): Promise<void> {
  try {
    const connection = await getRedisConnection();
    
    if (!connection) {
      console.log('🔄 QUEUE: Initializing in-memory mode for development');
      isInMemoryMode = true;
      return;
    }

    console.log('🚀 QUEUE: Initializing Redis BullMQ');
    
    // Create queue
    agentQueue = new Queue('agent-tasks', {
      ...queueConfig,
      ...connection,
    } as QueueOptions);

    // Create worker for job processing
    agentWorker = new Worker('agent-tasks', processJob, {
      ...connection,
      concurrency: 5, // Process up to 5 jobs concurrently
      removeOnComplete: 100,
      removeOnFail: 50,
    } as WorkerOptions);

    // Create queue events listener
    queueEvents = new QueueEvents('agent-tasks', connection as QueueEventsOptions);
    
    // Setup event listeners
    setupQueueEventListeners();
    setupWorkerEventListeners();
    
    console.log('✅ QUEUE: Redis BullMQ with Worker initialized successfully');
  } catch (error) {
    console.error('❌ QUEUE: Failed to initialize Redis BullMQ:', error);
    console.log('🔄 QUEUE: Falling back to in-memory mode');
    isInMemoryMode = true;
  }
}

// Job processing function for Worker
async function processJob(job: Job): Promise<any> {
  const { type, payload } = job.data as { type: TaskType; payload: TaskPayload };
  
  console.log(`⚡ WORKER: Processing job ${job.id} of type ${type}`);
  
  try {
    switch (type) {
      case TaskType.BROWSER_AUTOMATION:
        return await processBrowserAutomationJob(job);
      case TaskType.SESSION_START:
        return await processSessionStartJob(job);
      case TaskType.SESSION_END:
        return await processSessionEndJob(job);
      default:
        throw new Error(`Unknown task type: ${type}`);
    }
  } catch (error) {
    console.error(`❌ WORKER: Job ${job.id} failed:`, error);
    throw error;
  }
}

// Browser automation job processor
async function processBrowserAutomationJob(job: Job): Promise<any> {
  const payload = job.data.payload as BrowserAutomationPayload;
  
  try {
    // Initial setup stage
    await job.updateProgress(10);
    await broadcastTaskProgress(job.id!, 10, 'Initializing browser automation engine', [
      'Setting up browser context...',
      'Loading neural networks...'
    ]);
    
    // Execute browser automation task
    console.log(`🌐 BROWSER: Executing "${payload.instruction}"`);
    await broadcastTaskProgress(job.id!, 25, 'Creating automation task', [
      `Instruction: "${payload.instruction}"`,
      'Analyzing target environment...'
    ]);
    
    const result = await browserAgent.createTask(payload.sessionId, payload.instruction);
    
    // Task created successfully
    await job.updateProgress(50);
    await broadcastTaskProgress(job.id!, 50, 'Executing automation sequence', [
      `Task ID: ${result}`,
      'Browser automation in progress...'
    ]);
    
    // Wait for task completion with detailed progress updates
    let attempts = 0;
    const maxAttempts = 60; // 60 seconds timeout
    let lastLoggedProgress = 50;
    
    while (attempts < maxAttempts) {
      const taskStatus = await browserAgent.getTask(result);
      
      if (taskStatus && taskStatus.status === 'completed') {
        await job.updateProgress(100);
        await broadcastTaskProgress(job.id!, 100, 'Task completed successfully', [
          'Automation sequence completed',
          'Processing results...',
          'Task execution finished'
        ]);
        
        return {
          success: true,
          taskId: result,
          result: taskStatus.result,
          steps: taskStatus.steps,
          message: `Browser automation completed successfully`
        };
      } else if (taskStatus && taskStatus.status === 'failed') {
        await broadcastTaskProgress(job.id!, 0, 'Task execution failed', [
          `Error: ${taskStatus.error}`,
          'Automation sequence terminated'
        ]);
        throw new Error(`Browser automation failed: ${taskStatus.error}`);
      }
      
      // Update progress incrementally with detailed logs
      const progress = Math.min(95, 50 + (attempts / maxAttempts) * 45);
      await job.updateProgress(progress);
      
      // Send detailed progress updates every 10% increment
      if (progress - lastLoggedProgress >= 10) {
        const stage = attempts < 20 ? 'Executing browser commands' :
                     attempts < 40 ? 'Processing intermediate results' : 
                     'Finalizing automation sequence';
        
        await broadcastTaskProgress(job.id!, progress, stage, [
          `Progress: ${Math.round(progress)}%`,
          `Elapsed time: ${attempts} seconds`,
          `Estimated remaining: ${Math.max(0, maxAttempts - attempts)} seconds`
        ]);
        
        lastLoggedProgress = progress;
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }
    
    await broadcastTaskProgress(job.id!, 0, 'Task execution timeout', [
      'Browser automation timed out after 60 seconds',
      'Consider simplifying the task or increasing timeout'
    ]);
    throw new Error('Browser automation timed out after 60 seconds');
  } catch (error) {
    console.error(`❌ BROWSER: Automation failed:`, error);
    await broadcastTaskProgress(job.id!, 0, 'Task execution error', [
      `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'Browser automation terminated unexpectedly'
    ]);
    throw error;
  }
}

// Session start job processor
async function processSessionStartJob(job: Job): Promise<any> {
  const payload = job.data.payload as SessionStartPayload;
  
  console.log(`🚀 SESSION: Starting session ${payload.sessionId} for agent ${payload.agentId}`);
  
  // Perform session initialization tasks
  // This could include setting up browser contexts, initializing AI agents, etc.
  
  return {
    success: true,
    message: `Session ${payload.sessionId} started successfully`,
    agentId: payload.agentId,
    sessionId: payload.sessionId
  };
}

// Session end job processor
async function processSessionEndJob(job: Job): Promise<any> {
  const payload = job.data.payload as SessionEndPayload;
  
  console.log(`📴 SESSION: Ending session ${payload.sessionId} for agent ${payload.agentId}`);
  
  // Perform session cleanup tasks
  // This could include closing browser contexts, saving final state, etc.
  
  return {
    success: true,
    message: `Session ${payload.sessionId} ended successfully`,
    reason: payload.reason
  };
}

// Setup queue event listeners
function setupQueueEventListeners(): void {
  if (!queueEvents) return;
  
  queueEvents.on('waiting', async ({ jobId }) => {
    console.log(`📋 TASK ${jobId}: Queued and waiting`);
    await broadcastTaskStatusUpdate(jobId, TaskStatus.PENDING);
  });
  
  queueEvents.on('active', async ({ jobId }) => {
    console.log(`⚡ TASK ${jobId}: Started processing`);
    await broadcastTaskStatusUpdate(jobId, TaskStatus.PROCESSING);
  });
  
  queueEvents.on('completed', async ({ jobId, returnvalue }) => {
    console.log(`✅ TASK ${jobId}: Completed successfully`);
    await broadcastTaskStatusUpdate(jobId, TaskStatus.COMPLETED, 100, returnvalue);
  });
  
  queueEvents.on('failed', async ({ jobId, failedReason }) => {
    console.error(`❌ TASK ${jobId}: Failed - ${failedReason}`);
    await broadcastTaskStatusUpdate(jobId, TaskStatus.FAILED, undefined, undefined, failedReason);
  });

  queueEvents.on('progress', async ({ jobId, data }) => {
    if (typeof data === 'number') {
      await broadcastTaskProgress(jobId, data);
    }
  });
}

// Setup worker event listeners for storage synchronization
function setupWorkerEventListeners(): void {
  if (!agentWorker) return;
  
  agentWorker.on('active', async (job: Job) => {
    console.log(`🛠️ WORKER: Job ${job.id} started processing`);
    
    try {
      // Update storage when job becomes active
      await storage.updateTaskStatus(job.id!, TaskStatus.PROCESSING);
      
      // Broadcast WebSocket status update
      await broadcastTaskStatusUpdate(job.id!, TaskStatus.PROCESSING);
    } catch (error) {
      console.error(`❌ WORKER: Failed to update task status for ${job.id}:`, error);
    }
  });
  
  agentWorker.on('completed', async (job: Job, result: any) => {
    console.log(`✅ WORKER: Job ${job.id} completed`);
    
    try {
      // Update storage when job completes
      const completedAt = new Date();
      await storage.updateTaskStatus(job.id!, TaskStatus.COMPLETED, completedAt);
      
      // Create task result record
      await storage.createTaskResult({
        taskId: job.id!,
        result: result,
        logs: [`Job completed successfully at ${completedAt.toISOString()}`],
        duration: job.processedOn ? `${Date.now() - job.processedOn}ms` : null,
        workerInfo: {
          workerId: agentWorker?.id || 'unknown',
          processedOn: job.processedOn,
          finishedOn: job.finishedOn
        }
      });
      
      // Broadcast WebSocket completion update
      await broadcastTaskStatusUpdate(job.id!, TaskStatus.COMPLETED, 100, result);
    } catch (error) {
      console.error(`❌ WORKER: Failed to update storage for completed job ${job.id}:`, error);
    }
  });
  
  agentWorker.on('failed', async (job: Job | undefined, error: Error) => {
    console.error(`❌ WORKER: Job ${job?.id || 'unknown'} failed:`, error.message);
    
    if (!job?.id) {
      console.error(`❌ WORKER: Job is undefined or missing ID, cannot update storage`);
      return;
    }
    
    try {
      // Update storage when job fails
      const failedAt = new Date();
      await storage.updateTaskStatus(job.id, TaskStatus.FAILED, failedAt);
      
      // Create task result record with error
      await storage.createTaskResult({
        taskId: job.id,
        error: error.message,
        logs: [`Job failed at ${failedAt.toISOString()}: ${error.message}`],
        duration: job.processedOn ? `${Date.now() - job.processedOn}ms` : null,
        workerInfo: {
          workerId: agentWorker?.id || 'unknown',
          processedOn: job.processedOn,
          failedReason: job.failedReason
        }
      });
      
      // Broadcast WebSocket failure update
      await broadcastTaskStatusUpdate(job.id, TaskStatus.FAILED, undefined, undefined, error.message);
    } catch (storageError) {
      console.error(`❌ WORKER: Failed to update storage for failed job ${job.id}:`, storageError);
    }
  });
  
  agentWorker.on('error', (error: Error) => {
    console.error(`❌ WORKER: Worker error:`, error);
  });
}

// Add task to queue with PRODUCTION OPTIMIZATION: Batching system
export async function addTask(
  type: TaskType,
  payload: TaskPayload,
  priority: TaskPriority = TaskPriority.MEDIUM,
  delay?: number
): Promise<string> {
  try {
    if (isInMemoryMode) {
      return addInMemoryTask(type, payload, priority, delay);
    }

    if (!agentQueue) {
      throw new Error('Queue not initialized');
    }

    // PRODUCTION OPTIMIZATION: Use batching system for all tasks except urgent ones
    // Only bypass batching for truly urgent tasks (immediate + high priority)
    if (priority === TaskPriority.HIGH && (!delay || delay === 0)) {
      const job = await agentQueue.add(
        type,
        { type, payload },
        {
          priority: getPriorityValue(priority),
          delay: delay,
          removeOnComplete: 100,
          removeOnFail: 50,
        }
      );

      // Create task record in storage using BullMQ job.id as the Task.id
      await storage.createTaskWithId(job.id!, {
        sessionId: payload.sessionId,
        agentId: payload.agentId,
        type: type,
        status: TaskStatus.PENDING,
        payload: payload as any,
        priority: priority,
        attempts: "0",
        maxRetries: "3",
        scheduledAt: delay ? new Date(Date.now() + delay) : new Date(),
      });

      console.log(`📋 QUEUE: Added urgent task ${job.id} of type ${type} (bypassed batching)`);
      return job.id!;
    }

    // PRODUCTION OPTIMIZATION: Add to batch for better throughput
    // Note: Storage record will be created when batch is processed with actual BullMQ job ID
    
    // Use a shared batch ID to group tasks together
    let batchId = 'current_batch';
    let batch = taskBatches.get(batchId);
    
    // Create new batch if none exists or current batch is full
    if (!batch || batch.tasks.length >= BATCH_SIZE) {
      batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      batch = {
        tasks: [],
        batchId,
        createdAt: Date.now()
      };
      taskBatches.set(batchId, batch);
    }

    // Add task to batch
    batch.tasks.push({ type, payload, priority, delay });

    console.log(`📋 QUEUE: Added task to batch ${batchId} (${batch.tasks.length}/${BATCH_SIZE})`);

    // Schedule batch processing if batch is full or trigger timeout
    if (batch.tasks.length >= BATCH_SIZE) {
      console.log(`🚀 QUEUE: Batch ${batchId} is full, processing immediately`);
      await processBatchedTasks();
    } else {
      scheduleBatchProcessing();
    }

    // PRODUCTION FIX: Return a placeholder ID since actual BullMQ job IDs will be generated during batch processing
    // This is not ideal but maintains backward compatibility with existing code that expects a task ID
    const placeholderTaskId = `batch_pending_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log(`⚠️  QUEUE: Returning placeholder task ID ${placeholderTaskId} - actual BullMQ job IDs will be generated during batch processing`);
    return placeholderTaskId;
  } catch (error) {
    console.error('❌ QUEUE: Failed to add task:', error);
    throw error;
  }
}

// In-memory task processing for development
function addInMemoryTask(
  type: TaskType,
  payload: TaskPayload,
  priority: TaskPriority,
  delay?: number
): string {
  const taskId = `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const task: InMemoryTask = {
    id: taskId,
    data: payload,
    opts: { priority: getPriorityValue(priority), delay },
    status: TaskStatus.PENDING,
    createdAt: new Date(),
    processedAt: undefined,
    completedAt: undefined,
    failedAt: undefined,
    result: undefined,
    error: undefined,
  };

  inMemoryTasks.set(taskId, task);

  // Create storage record with in-memory task ID
  storage.createTaskWithId(taskId, {
    sessionId: payload.sessionId,
    agentId: payload.agentId,
    type: type,
    status: TaskStatus.PENDING,
    payload: payload as any,
    priority: priority,
    attempts: "0",
    maxRetries: "3",
    scheduledAt: delay ? new Date(Date.now() + delay) : new Date(),
  }).catch(error => {
    console.error(`❌ MEMORY TASK ${taskId}: Failed to create storage record:`, error);
  });

  // Simulate async processing in development
  setTimeout(async () => {
    try {
      task.status = TaskStatus.PROCESSING;
      task.processedAt = new Date();
      
      // Update storage when processing starts
      await storage.updateTaskStatus(taskId, TaskStatus.PROCESSING);
      
      // Broadcast WebSocket status update
      await broadcastTaskStatusUpdate(taskId, TaskStatus.PROCESSING);
      await broadcastTaskProgress(taskId, 10, 'Starting task simulation', [
        `Task type: ${type}`,
        'Development mode simulation active'
      ]);
      
      // Simulate task processing (would be done by worker in production)
      console.log(`⚡ MEMORY TASK ${taskId}: Simulating processing of ${type}`);
      
      // Simulate progress updates during processing
      const steps = [
        { progress: 25, stage: 'Initializing task execution', logs: ['Setting up simulation environment'] },
        { progress: 50, stage: 'Processing task logic', logs: ['Executing main task simulation'] },
        { progress: 75, stage: 'Finalizing results', logs: ['Preparing task completion'] }
      ];
      
      for (const step of steps) {
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
        await broadcastTaskProgress(taskId, step.progress, step.stage, step.logs);
      }
      
      await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
      
      // Mark as completed
      task.status = TaskStatus.COMPLETED;
      task.completedAt = new Date();
      task.result = { 
        success: true, 
        message: `${type} completed successfully in development mode`,
        simulatedResult: true 
      };
      
      console.log(`✅ MEMORY TASK ${taskId}: Completed successfully`);
      
      // Update storage and create result
      await storage.updateTaskStatus(taskId, TaskStatus.COMPLETED, new Date());
      await storage.createTaskResult({
        taskId: taskId,
        result: task.result,
        logs: [`Task ${type} completed in development mode`],
        duration: "2-3 seconds",
        workerInfo: { mode: "development", simulated: true }
      });
      
      // Broadcast WebSocket completion update
      await broadcastTaskStatusUpdate(taskId, TaskStatus.COMPLETED, 100, task.result);
      await broadcastTaskProgress(taskId, 100, 'Task completed successfully', [
        'Simulation finished',
        'Task execution completed',
        'Ready for next task'
      ]);
    } catch (error) {
      task.status = TaskStatus.FAILED;
      task.failedAt = new Date();
      task.error = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ MEMORY TASK ${taskId}: Failed - ${task.error}`);
      
      await storage.updateTaskStatus(taskId, TaskStatus.FAILED, new Date());
      await storage.createTaskResult({
        taskId: taskId,
        error: task.error,
        logs: [`Task ${type} failed in development mode: ${task.error}`],
        workerInfo: { mode: "development", simulated: true }
      });
      
      // Broadcast WebSocket failure update
      await broadcastTaskStatusUpdate(taskId, TaskStatus.FAILED, undefined, undefined, task.error);
      await broadcastTaskProgress(taskId, 0, 'Task execution failed', [
        `Error: ${task.error}`,
        'Simulation terminated'
      ]);
    }
  }, delay || 500);

  return taskId;
}

// Get task status
export async function getTaskStatus(taskId: string): Promise<{
  id: string;
  status: TaskStatus;
  result?: any;
  error?: string;
  progress?: number;
} | null> {
  try {
    if (isInMemoryMode) {
      const task = inMemoryTasks.get(taskId);
      if (!task) return null;
      
      return {
        id: task.id,
        status: task.status,
        result: task.result,
        error: task.error,
        progress: task.status === TaskStatus.COMPLETED ? 100 : 
                 task.status === TaskStatus.PROCESSING ? 50 : 0,
      };
    }

    if (!agentQueue) {
      throw new Error('Queue not initialized');
    }

    const job = await agentQueue.getJob(taskId);
    if (!job) return null;

    const state = await job.getState();
    const progress = job.progress || 0;

    return {
      id: job.id!,
      status: mapJobStateToTaskStatus(state),
      result: job.returnvalue,
      error: job.failedReason,
      progress: typeof progress === 'number' ? progress : 0,
    };
  } catch (error) {
    console.error(`❌ QUEUE: Failed to get task status for ${taskId}:`, error);
    return null;
  }
}

// Get queue statistics
export async function getQueueStats(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  total: number;
}> {
  try {
    if (isInMemoryMode) {
      const tasks = Array.from(inMemoryTasks.values());
      return {
        waiting: tasks.filter(t => t.status === TaskStatus.PENDING).length,
        active: tasks.filter(t => t.status === TaskStatus.PROCESSING).length,
        completed: tasks.filter(t => t.status === TaskStatus.COMPLETED).length,
        failed: tasks.filter(t => t.status === TaskStatus.FAILED).length,
        total: tasks.length,
      };
    }

    if (!agentQueue) {
      throw new Error('Queue not initialized');
    }

    const counts = await agentQueue.getJobCounts();
    
    return {
      waiting: counts.waiting || 0,
      active: counts.active || 0,
      completed: counts.completed || 0,
      failed: counts.failed || 0,
      total: (counts.waiting || 0) + (counts.active || 0) + (counts.completed || 0) + (counts.failed || 0),
    };
  } catch (error) {
    console.error('❌ QUEUE: Failed to get queue stats:', error);
    return { waiting: 0, active: 0, completed: 0, failed: 0, total: 0 };
  }
}

// Cleanup queue
export async function closeQueue(): Promise<void> {
  try {
    if (agentWorker) {
      await agentWorker.close();
      agentWorker = null;
    }
    
    if (queueEvents) {
      await queueEvents.close();
      queueEvents = null;
    }
    
    if (agentQueue) {
      await agentQueue.close();
      agentQueue = null;
    }
    
    if (isInMemoryMode) {
      inMemoryTasks.clear();
    }
    
    console.log('🔄 QUEUE: Closed successfully');
  } catch (error) {
    console.error('❌ QUEUE: Failed to close:', error);
  }
}

// Helper functions
function getPriorityValue(priority: TaskPriority): number {
  switch (priority) {
    case TaskPriority.HIGH: return 1;
    case TaskPriority.MEDIUM: return 5;
    case TaskPriority.LOW: return 10;
    default: return 5;
  }
}

function mapJobStateToTaskStatus(state: string): TaskStatus {
  switch (state) {
    case 'waiting':
    case 'delayed': return TaskStatus.PENDING;
    case 'active': return TaskStatus.PROCESSING;
    case 'completed': return TaskStatus.COMPLETED;
    case 'failed': return TaskStatus.FAILED;
    default: return TaskStatus.PENDING;
  }
}

// WebSocket broadcasting helper functions
async function broadcastTaskStatusUpdate(
  taskId: string, 
  status: TaskStatus, 
  progress?: number, 
  result?: any, 
  error?: string
): Promise<void> {
  try {
    // Get task details from storage
    const task = await storage.getTask(taskId);
    if (!task) {
      console.error(`❌ WS: Cannot broadcast status for unknown task ${taskId}`);
      return;
    }

    // Broadcast task status via WebSocket
    await wsManager.broadcastTaskStatus(
      taskId,
      task.sessionId,
      task.agentId,
      status,
      task.type,
      progress,
      result || error ? { result, error } : undefined
    );
  } catch (broadcastError) {
    console.error(`❌ WS: Failed to broadcast task status for ${taskId}:`, broadcastError);
  }
}

async function broadcastTaskProgress(
  taskId: string, 
  progress: number, 
  stage?: string,
  logs?: string[]
): Promise<void> {
  try {
    // Get task details from storage
    const task = await storage.getTask(taskId);
    if (!task) {
      console.error(`❌ WS: Cannot broadcast progress for unknown task ${taskId}`);
      return;
    }

    // Broadcast task progress via WebSocket
    await wsManager.broadcastTaskProgress(
      taskId,
      task.sessionId,
      progress,
      stage
    );

    // Broadcast logs if provided
    if (logs && logs.length > 0) {
      await wsManager.broadcastTaskLogs(
        taskId,
        task.sessionId,
        logs,
        'info'
      );
    }
  } catch (broadcastError) {
    console.error(`❌ WS: Failed to broadcast task progress for ${taskId}:`, broadcastError);
  }
}

// Export queue instance for worker setup (future use)
export { agentQueue };