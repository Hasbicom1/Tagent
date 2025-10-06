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

/**
 * Initialize the queue system
 */
export async function initQueue(redisUrl) {
  if (!redisUrl) {
    console.log('⚠️  QUEUE: No Redis URL provided, queue disabled');
    return false;
  }

  try {
    console.log('🔌 QUEUE: Connecting to Redis for task queue...');
    
    redisConnection = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      }
    });

    taskQueue = new Queue('browser-automation', {
      connection: redisConnection
    });

    await redisConnection.ping();
    
    console.log('✅ QUEUE: Connected to Redis queue successfully');
    return true;
  } catch (error) {
    console.error('❌ QUEUE: Failed to initialize:', error.message);
    taskQueue = null;
    redisConnection = null;
    return false;
  }
}

/**
 * Add a browser automation task to the queue
 */
export async function queueBrowserTask(instruction, sessionId, agentId) {
  if (!taskQueue) {
    throw new Error('Queue not initialized');
  }

  try {
    const job = await taskQueue.add('automation', {
      instruction,
      sessionId,
      agentId
    }, {
      priority: 1, // High priority
      removeOnComplete: 100,
      removeOnFail: 50
    });

    console.log(`📋 QUEUE: Browser task queued: ${job.id}`);
    return {
      taskId: `task_${job.id}`,
      jobId: job.id
    };
  } catch (error) {
    console.error('❌ QUEUE: Failed to queue task:', error.message);
    throw error;
  }
}

/**
 * Get task status from queue
 */
export async function getTaskStatus(jobId) {
  if (!taskQueue) {
    throw new Error('Queue not initialized');
  }

  try {
    const job = await taskQueue.getJob(jobId);
    
    if (!job) {
      return { status: 'not_found' };
    }

    const state = await job.getState();
    const progress = job.progress;
    
    return {
      status: state,
      progress: progress || 0,
      data: job.data,
      returnvalue: job.returnvalue
    };
  } catch (error) {
    console.error('❌ QUEUE: Failed to get task status:', error.message);
    throw error;
  }
}

/**
 * Check if queue is available
 */
export function isQueueAvailable() {
  return taskQueue !== null && redisConnection !== null;
}

/**
 * Close queue connections
 */
export async function closeQueue() {
  if (taskQueue) {
    await taskQueue.close();
    taskQueue = null;
  }
  
  if (redisConnection) {
    await redisConnection.quit();
    redisConnection = null;
  }
  
  console.log('🔄 QUEUE: Closed successfully');
}

