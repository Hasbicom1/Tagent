/**
 * PHOENIX-7742 Integration Test
 * 
 * Tests integration between containerized workers and main application
 * Verifies queue connectivity, task processing, and WebSocket communication
 */

import { Redis } from 'ioredis';
import { Queue } from 'bullmq';
import WebSocket from 'ws';
import { BrowserEngine } from './browser-engine.js';
import { QueueConsumer } from './queue-consumer.js';
import { WorkerManager } from './worker-manager.js';

interface TestConfig {
  redisUrl: string;
  websocketUrl: string;
  testTimeout: number;
  workerId: string;
}

interface TestResult {
  name: string;
  success: boolean;
  duration: number;
  error?: string;
  details?: any;
}

class IntegrationTester {
  private config: TestConfig;
  private redis: Redis;
  private queue: Queue;
  private results: TestResult[] = [];

  constructor(config: Partial<TestConfig> = {}) {
    this.config = {
      redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
      websocketUrl: process.env.WS_URL || 'ws://localhost:5000/ws',
      testTimeout: 30000,
      workerId: 'test-worker',
      ...config,
    };

    try {
      this.redis = new Redis(this.config.redisUrl, {
        lazyConnect: true,
        connectTimeout: 5000,
        commandTimeout: 3000,
      });
      this.queue = new Queue('agent-tasks', { connection: this.redis });
    } catch (error) {
      console.error('❌ INTEGRATION-TEST: Redis initialization failed:', error instanceof Error ? error.message : error);
      console.log('⚠️  Integration tests will be skipped due to Redis connection failure');
      this.redis = null as any;
      this.queue = null as any;
    }
  }

  /**
   * Run complete integration test suite
   */
  async runTests(): Promise<TestResult[]> {
    console.log('🧪 PHOENIX-7742 Integration Test Suite Starting...');
    console.log('📝 Test Configuration:', this.config);

    try {
      // Core connectivity tests
      await this.testRedisConnection();
      await this.testQueueConnection();
      await this.testWebSocketConnection();

      // Component tests
      await this.testBrowserEngine();
      await this.testWorkerManager();
      await this.testQueueConsumer();

      // End-to-end integration tests
      await this.testTaskProcessingFlow();
      await this.testWebSocketIntegration();
      await this.testConcurrentProcessing();

      // Performance tests
      await this.testWorkerPerformance();

    } catch (error) {
      console.error('💥 Test suite failed:', error);
    } finally {
      await this.cleanup();
    }

    this.printResults();
    return this.results;
  }

  /**
   * Test Redis connection
   */
  private async testRedisConnection(): Promise<void> {
    const startTime = performance.now();
    try {
      await this.redis.ping();
      const info = await this.redis.info('server');
      
      this.addResult('Redis Connection', true, performance.now() - startTime, {
        serverInfo: info.split('\n')[1], // Redis version line
      });
    } catch (error) {
      this.addResult('Redis Connection', false, performance.now() - startTime, error);
    }
  }

  /**
   * Test BullMQ queue connection
   */
  private async testQueueConnection(): Promise<void> {
    const startTime = performance.now();
    try {
      // Test basic queue operations
      const testJob = await this.queue.add('test-connection', { test: true });
      await testJob.remove();

      const queueStatus = await this.queue.getWaiting();
      
      this.addResult('Queue Connection', true, performance.now() - startTime, {
        queueName: this.queue.name,
        waitingJobs: queueStatus.length,
      });
    } catch (error) {
      this.addResult('Queue Connection', false, performance.now() - startTime, error);
    }
  }

  /**
   * Test WebSocket connection
   */
  private async testWebSocketConnection(): Promise<void> {
    const startTime = performance.now();
    
    return new Promise((resolve) => {
      try {
        const ws = new WebSocket(this.config.websocketUrl);
        
        const timeout = setTimeout(() => {
          ws.close();
          this.addResult('WebSocket Connection', false, performance.now() - startTime, 
            new Error('Connection timeout'));
          resolve();
        }, 5000);

        ws.on('open', () => {
          clearTimeout(timeout);
          ws.close();
          this.addResult('WebSocket Connection', true, performance.now() - startTime);
          resolve();
        });

        ws.on('error', (error) => {
          clearTimeout(timeout);
          this.addResult('WebSocket Connection', false, performance.now() - startTime, error);
          resolve();
        });

      } catch (error) {
        this.addResult('WebSocket Connection', false, performance.now() - startTime, error);
        resolve();
      }
    });
  }

  /**
   * Test browser engine initialization
   */
  private async testBrowserEngine(): Promise<void> {
    const startTime = performance.now();
    try {
      const engine = new BrowserEngine({
        browserType: 'chromium',
        headless: true,
        maxConcurrentSessions: 1,
      });

      await engine.initialize();

      // Test simple browser task
      const testTask = {
        id: 'test-task',
        sessionId: 'test-session',
        instruction: 'Navigate to a test page',
        timeout: 10000,
      };

      const result = await engine.executeTask(testTask);
      await engine.cleanup();

      this.addResult('Browser Engine', result.success, performance.now() - startTime, {
        steps: result.steps.length,
        executionTime: result.executionTime,
      });

    } catch (error) {
      this.addResult('Browser Engine', false, performance.now() - startTime, error);
    }
  }

  /**
   * Test worker manager
   */
  private async testWorkerManager(): Promise<void> {
    const startTime = performance.now();
    try {
      const manager = new WorkerManager({
        workerId: this.config.workerId,
        maxConcurrentTasks: 2,
        taskTimeout: 10000,
        resourceMonitoringInterval: 30000,
      });

      await manager.start();

      // Test task registration
      manager.registerTask('test-task-1');
      manager.registerTask('test-task-2');

      const canAccept = manager.canAcceptTask();
      const isHealthy = manager.isHealthy();

      manager.completeTask('test-task-1', true);
      manager.completeTask('test-task-2', true);

      await manager.stop();

      this.addResult('Worker Manager', true, performance.now() - startTime, {
        canAcceptTasks: canAccept,
        isHealthy: isHealthy,
        stats: manager.getStats(),
      });

    } catch (error) {
      this.addResult('Worker Manager', false, performance.now() - startTime, error);
    }
  }

  /**
   * Test queue consumer
   */
  private async testQueueConsumer(): Promise<void> {
    const startTime = performance.now();
    try {
      const engine = new BrowserEngine({ headless: true });
      const manager = new WorkerManager({
        workerId: this.config.workerId,
        maxConcurrentTasks: 1,
        taskTimeout: 10000,
        resourceMonitoringInterval: 30000,
      });

      const consumer = new QueueConsumer(this.redis, engine, manager, {
        workerId: this.config.workerId,
        maxConcurrentTasks: 1,
        taskTimeout: 10000,
      });

      await engine.initialize();
      await manager.start();

      // Test consumer start/stop
      await consumer.start();
      const stats = consumer.getStats();
      await consumer.stop();

      await manager.stop();
      await engine.cleanup();

      this.addResult('Queue Consumer', true, performance.now() - startTime, {
        stats,
      });

    } catch (error) {
      this.addResult('Queue Consumer', false, performance.now() - startTime, error);
    }
  }

  /**
   * Test complete task processing flow
   */
  private async testTaskProcessingFlow(): Promise<void> {
    const startTime = performance.now();
    try {
      // Create a test browser automation task
      const taskPayload = {
        type: 'BROWSER_AUTOMATION',
        payload: {
          instruction: 'Navigate to a test page and extract title',
          sessionId: 'test-session',
          agentId: 'test-agent',
          url: 'data:text/html,<title>Test Page</title><h1>Hello World</h1>',
        },
      };

      // Add task to queue
      const job = await this.queue.add('task-processing-test', taskPayload, {
        removeOnComplete: 1,
        removeOnFail: 1,
      });

      // Wait for job completion (with timeout)
      const queueEvents = new (await import('bullmq')).QueueEvents('agent-tasks', { connection: this.redis });
      const result = await job.waitUntilFinished(queueEvents, this.config.testTimeout);
      await queueEvents.close();

      this.addResult('Task Processing Flow', true, performance.now() - startTime, {
        jobId: job.id,
        result: result?.success || false,
        duration: result?.executionTime || 0,
      });

    } catch (error) {
      this.addResult('Task Processing Flow', false, performance.now() - startTime, error);
    }
  }

  /**
   * Test WebSocket integration for real-time updates
   */
  private async testWebSocketIntegration(): Promise<void> {
    const startTime = performance.now();
    
    return new Promise((resolve) => {
      try {
        const ws = new WebSocket(this.config.websocketUrl);
        let progressReceived = false;

        const timeout = setTimeout(() => {
          ws.close();
          this.addResult('WebSocket Integration', progressReceived, 
            performance.now() - startTime, {
              progressReceived,
            });
          resolve();
        }, 15000);

        ws.on('open', async () => {
          // Authenticate (if required)
          ws.send(JSON.stringify({
            type: 'authenticate',
            sessionToken: 'test-token',
            agentId: 'test-agent',
          }));

          // Subscribe to task updates
          ws.send(JSON.stringify({
            type: 'subscribe',
            subscriptionType: 'task_progress',
            targetId: 'test-agent',
          }));

          // Create a task that should generate progress updates
          const taskPayload = {
            type: 'BROWSER_AUTOMATION',
            payload: {
              instruction: 'Test WebSocket integration',
              sessionId: 'test-session',
              agentId: 'test-agent',
            },
          };

          await this.queue.add('websocket-test', taskPayload);
        });

        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            if (message.type === 'task_progress') {
              progressReceived = true;
            }
          } catch (error) {
            // Ignore parse errors
          }
        });

        ws.on('error', (error) => {
          clearTimeout(timeout);
          this.addResult('WebSocket Integration', false, performance.now() - startTime, error);
          resolve();
        });

      } catch (error) {
        this.addResult('WebSocket Integration', false, performance.now() - startTime, error);
        resolve();
      }
    });
  }

  /**
   * Test concurrent task processing
   */
  private async testConcurrentProcessing(): Promise<void> {
    const startTime = performance.now();
    try {
      const concurrentTasks = 3;
      const taskPromises = [];

      for (let i = 0; i < concurrentTasks; i++) {
        const taskPayload = {
          type: 'BROWSER_AUTOMATION',
          payload: {
            instruction: `Concurrent test task ${i + 1}`,
            sessionId: `test-session-${i + 1}`,
            agentId: 'test-agent',
          },
        };

        const job = this.queue.add(`concurrent-test-${i + 1}`, taskPayload);
        taskPromises.push(job);
      }

      const jobs = await Promise.all(taskPromises);
      const queueEvents = new (await import('bullmq')).QueueEvents('agent-tasks', { connection: this.redis });
      const results = await Promise.all(
        jobs.map(job => job.waitUntilFinished(queueEvents, this.config.testTimeout))
      );
      await queueEvents.close();

      const successCount = results.filter(r => r?.success).length;

      this.addResult('Concurrent Processing', successCount === concurrentTasks, 
        performance.now() - startTime, {
          tasksSubmitted: concurrentTasks,
          tasksSucceeded: successCount,
          tasksFailed: concurrentTasks - successCount,
        });

    } catch (error) {
      this.addResult('Concurrent Processing', false, performance.now() - startTime, error);
    }
  }

  /**
   * Test worker performance under load
   */
  private async testWorkerPerformance(): Promise<void> {
    const startTime = performance.now();
    try {
      const loadTasks = 5;
      const taskPromises = [];

      for (let i = 0; i < loadTasks; i++) {
        const taskPayload = {
          type: 'BROWSER_AUTOMATION',
          payload: {
            instruction: `Performance test task ${i + 1}`,
            sessionId: `perf-session-${i + 1}`,
            agentId: 'test-agent',
          },
        };

        taskPromises.push(this.queue.add(`perf-test-${i + 1}`, taskPayload));
      }

      const startExecution = performance.now();
      const jobs = await Promise.all(taskPromises);
      const queueEvents = new (await import('bullmq')).QueueEvents('agent-tasks', { connection: this.redis });
      const results = await Promise.all(
        jobs.map(job => job.waitUntilFinished(queueEvents, this.config.testTimeout))
      );
      await queueEvents.close();
      const endExecution = performance.now();

      const totalExecutionTime = endExecution - startExecution;
      const avgExecutionTime = totalExecutionTime / loadTasks;
      const successCount = results.filter(r => r?.success).length;

      this.addResult('Worker Performance', successCount === loadTasks, 
        performance.now() - startTime, {
          tasksProcessed: loadTasks,
          totalExecutionTime: `${totalExecutionTime.toFixed(2)}ms`,
          avgExecutionTime: `${avgExecutionTime.toFixed(2)}ms`,
          throughput: `${(loadTasks / (totalExecutionTime / 1000)).toFixed(2)} tasks/sec`,
          successRate: `${((successCount / loadTasks) * 100).toFixed(1)}%`,
        });

    } catch (error) {
      this.addResult('Worker Performance', false, performance.now() - startTime, error);
    }
  }

  /**
   * Add test result
   */
  private addResult(name: string, success: boolean, duration: number, errorOrDetails?: any): void {
    const result: TestResult = {
      name,
      success,
      duration: Math.round(duration),
    };

    if (success) {
      result.details = errorOrDetails;
    } else {
      result.error = errorOrDetails instanceof Error ? errorOrDetails.message : String(errorOrDetails);
    }

    this.results.push(result);
  }

  /**
   * Print test results
   */
  private printResults(): void {
    console.log('\n📊 Integration Test Results:');
    console.log('═'.repeat(80));

    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    const total = this.results.length;

    this.results.forEach((result, index) => {
      const status = result.success ? '✅' : '❌';
      const duration = `${result.duration}ms`;
      
      console.log(`${index + 1}. ${status} ${result.name.padEnd(25)} (${duration})`);
      
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      } else if (result.details) {
        console.log(`   Details: ${JSON.stringify(result.details, null, 2).substring(0, 200)}...`);
      }
    });

    console.log('═'.repeat(80));
    console.log(`📈 Summary: ${passed}/${total} tests passed (${((passed/total)*100).toFixed(1)}%)`);
    
    if (failed > 0) {
      console.log(`❌ ${failed} tests failed`);
      process.exit(1);
    } else {
      console.log('🎉 All tests passed!');
      process.exit(0);
    }
  }

  /**
   * Cleanup resources
   */
  private async cleanup(): Promise<void> {
    try {
      await this.queue.close();
      await this.redis.quit();
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }
}

// Run tests if this is the main module
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const tester = new IntegrationTester();
  tester.runTests().catch(console.error);
}

export { IntegrationTester };