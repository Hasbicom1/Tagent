import { z } from "zod";

// WebSocket message types
export enum WSMessageType {
  // Client → Server messages
  SUBSCRIBE = 'SUBSCRIBE',
  UNSUBSCRIBE = 'UNSUBSCRIBE',
  PING = 'PING',
  AUTHENTICATE = 'AUTHENTICATE',
  
  // Server → Client messages  
  PONG = 'PONG',
  AUTHENTICATED = 'AUTHENTICATED',
  SUBSCRIBED = 'SUBSCRIBED',
  UNSUBSCRIBED = 'UNSUBSCRIBED',
  
  // Task-related broadcasts
  TASK_STATUS = 'TASK_STATUS',
  TASK_PROGRESS = 'TASK_PROGRESS', 
  TASK_LOGS = 'TASK_LOGS',
  TASK_ERROR = 'TASK_ERROR',
  
  // Session-related broadcasts
  SESSION_STATUS = 'SESSION_STATUS',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  
  // System messages
  CONNECTION_STATUS = 'CONNECTION_STATUS',
  ERROR = 'ERROR',
  
  // PRODUCTION OPTIMIZATION: Batching support
  BATCH = 'BATCH'
}

// Subscription types
export enum SubscriptionType {
  TASK = 'TASK',           // Subscribe to specific taskId updates
  SESSION = 'SESSION',     // Subscribe to all tasks in a sessionId
  AGENT = 'AGENT'         // Subscribe to all tasks for an agentId
}

// Task status from queue system  
export enum TaskStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING', 
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

// Task types from queue system
export enum TaskType {
  BROWSER_AUTOMATION = 'BROWSER_AUTOMATION',
  SESSION_START = 'SESSION_START', 
  SESSION_END = 'SESSION_END'
}

// Base WebSocket message interface
export interface WSBaseMessage {
  type: WSMessageType;
  timestamp: string;
  messageId?: string;
}

// Client → Server message schemas
export const subscribeMessageSchema = z.object({
  type: z.literal(WSMessageType.SUBSCRIBE),
  subscriptionType: z.nativeEnum(SubscriptionType),
  targetId: z.string(), // taskId, sessionId, or agentId
  timestamp: z.string(),
  messageId: z.string().optional()
});

export const unsubscribeMessageSchema = z.object({
  type: z.literal(WSMessageType.UNSUBSCRIBE),
  subscriptionType: z.nativeEnum(SubscriptionType),
  targetId: z.string(),
  timestamp: z.string(),
  messageId: z.string().optional()
});

export const authenticateMessageSchema = z.object({
  type: z.literal(WSMessageType.AUTHENTICATE),
  sessionToken: z.string(),
  agentId: z.string(),
  timestamp: z.string(),
  messageId: z.string().optional()
});

export const pingMessageSchema = z.object({
  type: z.literal(WSMessageType.PING),
  timestamp: z.string(),
  messageId: z.string().optional()
});

// Server → Client message schemas
export const taskStatusMessageSchema = z.object({
  type: z.literal(WSMessageType.TASK_STATUS),
  taskId: z.string(),
  sessionId: z.string(),
  agentId: z.string(),
  status: z.nativeEnum(TaskStatus),
  taskType: z.nativeEnum(TaskType),
  progress: z.number().min(0).max(100).optional(),
  timestamp: z.string(),
  messageId: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

export const taskProgressMessageSchema = z.object({
  type: z.literal(WSMessageType.TASK_PROGRESS),
  taskId: z.string(),
  sessionId: z.string(),
  progress: z.number().min(0).max(100),
  stage: z.string().optional(),
  estimatedTimeRemaining: z.number().optional(),
  timestamp: z.string(),
  messageId: z.string().optional()
});

export const taskLogsMessageSchema = z.object({
  type: z.literal(WSMessageType.TASK_LOGS),
  taskId: z.string(),
  sessionId: z.string(),
  logs: z.array(z.string()),
  logLevel: z.enum(['info', 'warn', 'error', 'debug']).default('info'),
  timestamp: z.string(),
  messageId: z.string().optional()
});

export const taskErrorMessageSchema = z.object({
  type: z.literal(WSMessageType.TASK_ERROR),
  taskId: z.string(),
  sessionId: z.string(),
  error: z.string(),
  details: z.record(z.any()).optional(),
  timestamp: z.string(),
  messageId: z.string().optional()
});

export const sessionStatusMessageSchema = z.object({
  type: z.literal(WSMessageType.SESSION_STATUS),
  sessionId: z.string(),
  agentId: z.string(),
  isActive: z.boolean(),
  expiresAt: z.string(),
  timeRemaining: z.number(), // minutes
  timestamp: z.string(),
  messageId: z.string().optional()
});

export const connectionStatusMessageSchema = z.object({
  type: z.literal(WSMessageType.CONNECTION_STATUS),
  status: z.enum(['connected', 'disconnected', 'reconnecting', 'error']),
  message: z.string().optional(),
  timestamp: z.string(),
  messageId: z.string().optional()
});

export const errorMessageSchema = z.object({
  type: z.literal(WSMessageType.ERROR),
  error: z.string(),
  code: z.string().optional(),
  details: z.record(z.any()).optional(),
  timestamp: z.string(),
  messageId: z.string().optional()
});

// PRODUCTION OPTIMIZATION: Batch message schema for high-throughput scenarios
export const batchMessageSchema = z.object({
  type: z.literal(WSMessageType.BATCH),
  messages: z.array(z.any()), // Array of individual messages
  batchId: z.string(),
  count: z.number(),
  totalSize: z.number(), // Size in bytes for monitoring
  timestamp: z.string(),
  messageId: z.string().optional()
});

// Union type for all client messages
export const clientMessageSchema = z.union([
  subscribeMessageSchema,
  unsubscribeMessageSchema, 
  authenticateMessageSchema,
  pingMessageSchema
]);

// Union type for all server messages  
export const serverMessageSchema = z.union([
  taskStatusMessageSchema,
  taskProgressMessageSchema,
  taskLogsMessageSchema,
  taskErrorMessageSchema,
  sessionStatusMessageSchema,
  connectionStatusMessageSchema,
  errorMessageSchema,
  batchMessageSchema,
  z.object({ type: z.literal(WSMessageType.PONG), timestamp: z.string(), messageId: z.string().optional() }),
  z.object({ type: z.literal(WSMessageType.AUTHENTICATED), timestamp: z.string(), messageId: z.string().optional() }),
  z.object({ type: z.literal(WSMessageType.SUBSCRIBED), subscriptionType: z.nativeEnum(SubscriptionType), targetId: z.string(), timestamp: z.string(), messageId: z.string().optional() }),
  z.object({ type: z.literal(WSMessageType.UNSUBSCRIBED), subscriptionType: z.nativeEnum(SubscriptionType), targetId: z.string(), timestamp: z.string(), messageId: z.string().optional() })
]);

// TypeScript types inferred from schemas
export type SubscribeMessage = z.infer<typeof subscribeMessageSchema>;
export type UnsubscribeMessage = z.infer<typeof unsubscribeMessageSchema>;
export type AuthenticateMessage = z.infer<typeof authenticateMessageSchema>;
export type PingMessage = z.infer<typeof pingMessageSchema>;

export type TaskStatusMessage = z.infer<typeof taskStatusMessageSchema>;
export type TaskProgressMessage = z.infer<typeof taskProgressMessageSchema>;
export type TaskLogsMessage = z.infer<typeof taskLogsMessageSchema>;
export type TaskErrorMessage = z.infer<typeof taskErrorMessageSchema>;
export type SessionStatusMessage = z.infer<typeof sessionStatusMessageSchema>;
export type ConnectionStatusMessage = z.infer<typeof connectionStatusMessageSchema>;
export type ErrorMessage = z.infer<typeof errorMessageSchema>;
export type BatchMessage = z.infer<typeof batchMessageSchema>;

export type ClientMessage = z.infer<typeof clientMessageSchema>;
export type ServerMessage = z.infer<typeof serverMessageSchema>;

// WebSocket connection state
export interface WSConnectionState {
  isConnected: boolean;
  lastPing?: Date;
  lastPong?: Date;
  authenticatedAgentId?: string;
  subscriptions: Set<string>;
  connectionId: string;
}

// Subscription tracking
export interface WSSubscription {
  connectionId: string;
  type: SubscriptionType;
  targetId: string;
  subscribedAt: Date;
}

// Broadcasting channels
export interface BroadcastChannel {
  type: SubscriptionType;
  targetId: string;
}

// WebSocket server configuration
export interface WSServerConfig {
  heartbeatInterval: number; // milliseconds
  heartbeatTimeout: number;  // milliseconds
  maxConnections: number;
  authRequired: boolean;
  enableRedisSync: boolean; // for multi-instance coordination
}

// Redis message for cross-instance coordination
export interface RedisWSMessage {
  channel: string;
  connectionIds?: string[]; // target specific connections, or all if undefined
  message: ServerMessage;
  excludeConnectionId?: string; // exclude sender connection
}

// Default configuration
export const DEFAULT_WS_CONFIG: WSServerConfig = {
  heartbeatInterval: 30000,  // 30 seconds
  heartbeatTimeout: 10000,   // 10 seconds  
  maxConnections: 1000,
  authRequired: true,
  enableRedisSync: true
};

// Utility functions for message creation
export function createTaskStatusMessage(
  taskId: string,
  sessionId: string, 
  agentId: string,
  status: TaskStatus,
  taskType: TaskType,
  progress?: number,
  metadata?: Record<string, any>
): TaskStatusMessage {
  return {
    type: WSMessageType.TASK_STATUS,
    taskId,
    sessionId,
    agentId,
    status,
    taskType,
    progress,
    timestamp: new Date().toISOString(),
    messageId: `task-status-${taskId}-${Date.now()}`,
    metadata
  };
}

export function createTaskProgressMessage(
  taskId: string,
  sessionId: string,
  progress: number,
  stage?: string,
  estimatedTimeRemaining?: number
): TaskProgressMessage {
  return {
    type: WSMessageType.TASK_PROGRESS,
    taskId,
    sessionId,
    progress,
    stage,
    estimatedTimeRemaining,
    timestamp: new Date().toISOString(),
    messageId: `task-progress-${taskId}-${Date.now()}`
  };
}

export function createTaskLogsMessage(
  taskId: string,
  sessionId: string,
  logs: string[],
  logLevel: 'info' | 'warn' | 'error' | 'debug' = 'info'
): TaskLogsMessage {
  return {
    type: WSMessageType.TASK_LOGS,
    taskId,
    sessionId,
    logs,
    logLevel,
    timestamp: new Date().toISOString(),
    messageId: `task-logs-${taskId}-${Date.now()}`
  };
}

export function createErrorMessage(
  error: string,
  code?: string,
  details?: Record<string, any>
): ErrorMessage {
  return {
    type: WSMessageType.ERROR,
    error,
    code,
    details,
    timestamp: new Date().toISOString(),
    messageId: `error-${Date.now()}`
  };
}