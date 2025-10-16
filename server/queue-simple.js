/**
 * SIMPLE REDIS QUEUE FOR PRODUCTION
 * 
 * Pure JavaScript queue wrapper for browser automation tasks
 * Works with worker-production-vnc.js which processes tasks via BullMQ
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const Redis = require('ioredis');
const { Queue } = require('bullmq');

let taskQueue = null;
let redisConnection = null;

// Enhanced logging for debugging
const logQueue = (level, message, data = null) => {
  const timestamp = new Date().toISOString();
  const prefix = `[QUEUE-${level}] ${timestamp}`;
  
  if (data) {
    console.log(`${prefix} ${message}`, JSON.stringify(data, null, 2));
  } else {
    console.log(`${prefix} ${message}`);
  }
};

/**
 * Initialize the queue system
 */
export async function initQueue(redisUrl) {
  logQueue('INFO', 'Initializing queue system', { redisUrl: redisUrl ? 'provided' : 'missing' });
  
  if (!redisUrl) {
    logQueue('WARN', 'No Redis URL provided, queue disabled');
    return false;
  }

  try {
    logQueue('INFO', 'Connecting to Redis for task queue...');
    
    // Inject credentials from env into URL if missing
    try {
      const u = new URL(redisUrl);
      const envPassword = process.env.REDIS_PASSWORD || process.env.RAILWAY_REDIS_PASSWORD;
      const envUsername = process.env.REDIS_USERNAME || process.env.RAILWAY_REDIS_USERNAME || (envPassword ? 'default' : undefined);
      if (envPassword && !u.password) {
        if (!u.username && envUsername) {
          u.username = envUsername;
        }
        u.password = envPassword;
        redisUrl = u.toString();
      } else if (!u.username && envUsername && u.password) {
        u.username = envUsername;
        redisUrl = u.toString();
      }
    } catch {}

    const connectionOptions = {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        logQueue('DEBUG', `Redis retry attempt ${times}, delay: ${delay}ms`);
        return delay;
      }
    };

    // Provide username/password options as a fallback for ioredis
    const envPasswordOpt = process.env.REDIS_PASSWORD || process.env.RAILWAY_REDIS_PASSWORD;
    const envUsernameOpt = process.env.REDIS_USERNAME || process.env.RAILWAY_REDIS_USERNAME || (envPasswordOpt ? 'default' : undefined);
    if (envPasswordOpt) connectionOptions.password = envPasswordOpt;
    if (envUsernameOpt) connectionOptions.username = envUsernameOpt;

    redisConnection = new Redis(redisUrl, connectionOptions);

    // Add Redis event listeners for debugging
    redisConnection.on('connect', () => {
      logQueue('INFO', 'Redis connection established');
    });
    
    redisConnection.on('ready', () => {
      logQueue('INFO', 'Redis connection ready');
    });
    
    redisConnection.on('error', (err) => {
      logQueue('ERROR', 'Redis connection error', { error: err.message });
    });
    
    redisConnection.on('close', () => {
      logQueue('WARN', 'Redis connection closed');
    });

    taskQueue = new Queue('browser-automation', {
      connection: redisConnection
    });

    // Add queue event listeners for debugging
    taskQueue.on('error', (err) => {
      logQueue('ERROR', 'Queue error', { error: err.message });
    });

    await redisConnection.ping();
    
    logQueue('SUCCESS', 'Connected to Redis queue successfully');
    return true;
  } catch (error) {
    logQueue('ERROR', 'Failed to initialize queue', { 
      error: error.message, 
      stack: error.stack 
    });
    taskQueue = null;
    redisConnection = null;
    return false;
  }
}

/**
 * Add a browser automation task to the queue
 */
export async function queueBrowserTask(instruction, sessionId, agentId) {
  logQueue('INFO', 'Attempting to queue browser task', {
    instruction: instruction?.substring(0, 100) + '...',
    sessionId,
    agentId,
    queueAvailable: !!taskQueue
  });

  if (!taskQueue) {
    logQueue('ERROR', 'Queue not initialized - cannot queue task');
    throw new Error('Queue not initialized');
  }

  try {
    const taskData = {
      instruction,
      sessionId,
      agentId,
      timestamp: new Date().toISOString(),
      source: 'checkout-success'
    };

    logQueue('DEBUG', 'Adding task to queue', taskData);

    const job = await taskQueue.add('automation', taskData, {
      priority: 1, // High priority
      removeOnComplete: 100,
      removeOnFail: 50,
      delay: 0, // Execute immediately
      attempts: 3
    });

    logQueue('SUCCESS', 'Browser task queued successfully', {
      jobId: job.id,
      taskId: `task_${job.id}`,
      sessionId,
      agentId
    });

    return {
      taskId: `task_${job.id}`,
      jobId: job.id
    };
  } catch (error) {
    logQueue('ERROR', 'Failed to queue task', {
      error: error.message,
      stack: error.stack,
      sessionId,
      agentId
    });
    throw error;
  }
}

/**
 * Get task status from queue
 */
export async function getTaskStatus(jobId) {
  logQueue('DEBUG', 'Getting task status', { jobId });

  if (!taskQueue) {
    logQueue('ERROR', 'Queue not initialized - cannot get task status');
    throw new Error('Queue not initialized');
  }

  try {
    const job = await taskQueue.getJob(jobId);
    
    if (!job) {
      logQueue('WARN', 'Job not found', { jobId });
      return { status: 'not_found' };
    }

    const state = await job.getState();
    const progress = job.progress;
    
    logQueue('DEBUG', 'Task status retrieved', {
      jobId,
      state,
      progress,
      hasReturnValue: !!job.returnvalue
    });
    
    return {
      status: state,
      progress: progress || 0,
      data: job.data,
      returnvalue: job.returnvalue
    };
  } catch (error) {
    logQueue('ERROR', 'Failed to get task status', {
      jobId,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * Check if queue is available
 */
export function isQueueAvailable() {
  const available = taskQueue !== null && redisConnection !== null;
  logQueue('DEBUG', 'Queue availability check', { 
    available, 
    hasTaskQueue: !!taskQueue, 
    hasRedisConnection: !!redisConnection 
  });
  return available;
}

/**
 * Close queue connections
 */
export async function closeQueue() {
  logQueue('INFO', 'Closing queue connections...');
  
  if (taskQueue) {
    try {
      await taskQueue.close();
      logQueue('INFO', 'Task queue closed');
    } catch (error) {
      logQueue('ERROR', 'Error closing task queue', { error: error.message });
    }
    taskQueue = null;
  }
  
  if (redisConnection) {
    try {
      await redisConnection.quit();
      logQueue('INFO', 'Redis connection closed');
    } catch (error) {
      logQueue('ERROR', 'Error closing Redis connection', { error: error.message });
    }
    redisConnection = null;
  }
  
  logQueue('SUCCESS', 'Queue closed successfully');
}

/**
 * Queue browser job after successful payment
 * This is the critical missing piece that connects payment to browser launch
 */
export async function queueBrowserJobAfterPayment(sessionId, agentId, websocketToken = null) {
  logQueue('INFO', 'Queueing browser job after payment', { sessionId, agentId, hasToken: !!websocketToken });

  if (!taskQueue) {
    logQueue('ERROR', 'Queue not initialized - cannot queue browser job');
    throw new Error('Queue not initialized');
  }

  try {
    // Store JWT token in Redis for worker to use
    if (websocketToken && redisConnection) {
      try {
        await redisConnection.hset(`session:${sessionId}`, {
          websocket_token: websocketToken,
          status: 'queued',
          queued_at: new Date().toISOString()
        });
        logQueue('INFO', 'JWT token stored in Redis for session', { sessionId });
      } catch (redisError) {
        logQueue('ERROR', 'Failed to store JWT token in Redis', { error: redisError.message });
      }
    }

    // Create a browser launch task
    const browserTask = {
      type: 'browser_launch',
      sessionId,
      agentId,
      instruction: 'Launch browser automation container for new session',
      timestamp: new Date().toISOString(),
      source: 'payment_success',
      websocketToken
    };

    logQueue('DEBUG', 'Creating browser launch task', browserTask);

    const job = await taskQueue.add('browser_launch', browserTask, {
      priority: 1, // High priority
      removeOnComplete: 100,
      removeOnFail: 50,
      delay: 0, // Execute immediately
      attempts: 3
    });

    logQueue('SUCCESS', 'Browser job queued after payment', {
      jobId: job.id,
      sessionId,
      agentId,
      hasToken: !!websocketToken
    });

    return {
      jobId: job.id,
      taskId: `browser_${job.id}`,
      sessionId,
      agentId
    };
  } catch (error) {
    logQueue('ERROR', 'Failed to queue browser job after payment', {
      error: error.message,
      stack: error.stack,
      sessionId,
      agentId
    });
    throw error;
  }
}

// Minimal compatibility exports used by api-routes.js
// These mirror the shape expected by routes without refactoring the queue system
export const TaskPriority = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH'
};

export const TaskType = {
  BROWSER_AUTOMATION: 'BROWSER_AUTOMATION',
  SESSION_START: 'SESSION_START',
  SESSION_END: 'SESSION_END'
};

// Lightweight addTask wrapper mapping known task types to simple-queue jobs
export async function addTask(type, payload, priority = TaskPriority.MEDIUM, delay = 0) {
  logQueue('INFO', 'addTask called', { type, sessionId: payload?.sessionId, agentId: payload?.agentId });

  if (!taskQueue) {
    logQueue('ERROR', 'Queue not initialized - cannot add task');
    throw new Error('Queue not initialized');
  }

  const jobName =
    type === TaskType.BROWSER_AUTOMATION ? 'automation' :
    type === TaskType.SESSION_START ? 'browser_launch' :
    type === TaskType.SESSION_END ? 'session_end' : 'automation';

  const priorityValue =
    priority === TaskPriority.HIGH ? 1 :
    priority === TaskPriority.MEDIUM ? 5 : 10;

  const data = {
    type,
    payload,
    sessionId: payload?.sessionId,
    agentId: payload?.agentId,
    timestamp: new Date().toISOString(),
    source: 'api-routes'
  };

  const jobOptions = {
    priority: priorityValue,
    delay: delay || 0,
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3
  };

  try {
    const job = await taskQueue.add(jobName, data, jobOptions);
    logQueue('SUCCESS', 'Task added', { type, jobId: job.id, jobName });
    return job.id;
  } catch (error) {
    logQueue('ERROR', 'Failed to add task', { error: error.message, type });
    throw error;
  }
}

