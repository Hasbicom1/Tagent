import { 
  type Session, 
  type InsertSession, 
  type Message, 
  type InsertMessage,
  type Execution,
  type InsertExecution,
  type Task,
  type InsertTask,
  type TaskResult,
  type InsertTaskResult 
} from "@shared/schema";
import { randomUUID } from "crypto";

// Storage interface for Agent HQ sessions
export interface IStorage {
  // Session management
  createSession(session: InsertSession): Promise<Session>;
  getSession(id: string): Promise<Session | undefined>;
  getSessionByAgentId(agentId: string): Promise<Session | undefined>;
  getSessionByCheckoutSessionId(checkoutSessionId: string): Promise<Session | undefined>;
  deactivateSession(id: string): Promise<void>;
  
  // Message management
  createMessage(message: InsertMessage): Promise<Message>;
  getSessionMessages(sessionId: string): Promise<Message[]>;
  getSessionChatHistory(sessionId: string): Promise<Message[]>;
  getSessionCommandHistory(sessionId: string): Promise<Message[]>;
  
  // Execution management
  createExecution(execution: InsertExecution): Promise<Execution>;
  updateExecutionStatus(id: string, status: "running" | "completed" | "failed", logs?: string[], completedAt?: Date): Promise<void>;
  getExecution(id: string): Promise<Execution | undefined>;
  getSessionExecutions(sessionId: string): Promise<Execution[]>;
  
  // Task queue management
  createTask(task: InsertTask): Promise<Task>;
  createTaskWithId(id: string, task: InsertTask): Promise<Task>;
  getTask(id: string): Promise<Task | undefined>;
  updateTaskStatus(id: string, status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED", completedAt?: Date): Promise<void>;
  getSessionTasks(sessionId: string): Promise<Task[]>;
  getTasksByStatus(status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED"): Promise<Task[]>;
  
  // Task result management
  createTaskResult(result: InsertTaskResult): Promise<TaskResult>;
  getTaskResult(taskId: string): Promise<TaskResult | undefined>;
}

export class MemStorage implements IStorage {
  private sessions: Map<string, Session>;
  private messages: Map<string, Message>;
  private executions: Map<string, Execution>;
  private tasks: Map<string, Task>;
  private taskResults: Map<string, TaskResult>;

  constructor() {
    this.sessions = new Map();
    this.messages = new Map();
    this.executions = new Map();
    this.tasks = new Map();
    this.taskResults = new Map();
  }

  async createSession(insertSession: InsertSession): Promise<Session> {
    const id = randomUUID();
    const session: Session = { 
      ...insertSession, 
      id,
      createdAt: new Date(),
      isActive: true
    };
    this.sessions.set(id, session);
    return session;
  }

  async getSession(id: string): Promise<Session | undefined> {
    return this.sessions.get(id);
  }

  async getSessionByAgentId(agentId: string): Promise<Session | undefined> {
    return Array.from(this.sessions.values()).find(
      (session) => session.agentId === agentId && session.isActive
    );
  }

  async getSessionByCheckoutSessionId(checkoutSessionId: string): Promise<Session | undefined> {
    return Array.from(this.sessions.values()).find(
      (session) => session.checkoutSessionId === checkoutSessionId
    );
  }

  async deactivateSession(id: string): Promise<void> {
    const session = this.sessions.get(id);
    if (session) {
      session.isActive = false;
      this.sessions.set(id, session);
    }
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const id = randomUUID();
    const message: Message = {
      ...insertMessage,
      id,
      timestamp: new Date(),
      messageType: insertMessage.messageType ?? "chat",
      inputMethod: insertMessage.inputMethod ?? "typing",
      hasExecutableTask: insertMessage.hasExecutableTask ?? false,
      taskDescription: insertMessage.taskDescription ?? null,
    };
    this.messages.set(id, message);
    return message;
  }

  async getSessionMessages(sessionId: string): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter((message) => message.sessionId === sessionId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  async getSessionChatHistory(sessionId: string): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter((message) => message.sessionId === sessionId && message.messageType === "chat")
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  async getSessionCommandHistory(sessionId: string): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter((message) => message.sessionId === sessionId && message.messageType === "command")
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  async createExecution(insertExecution: InsertExecution): Promise<Execution> {
    const id = randomUUID();
    const execution: Execution = {
      ...insertExecution,
      id,
      startedAt: new Date(),
      completedAt: null,
      logs: insertExecution.logs ?? null,
    };
    this.executions.set(id, execution);
    return execution;
  }

  async updateExecutionStatus(
    id: string, 
    status: "running" | "completed" | "failed", 
    logs?: string[], 
    completedAt?: Date
  ): Promise<void> {
    const execution = this.executions.get(id);
    if (execution) {
      execution.status = status;
      if (logs) execution.logs = logs;
      if (completedAt) execution.completedAt = completedAt;
      this.executions.set(id, execution);
    }
  }

  async getExecution(id: string): Promise<Execution | undefined> {
    return this.executions.get(id);
  }

  async getSessionExecutions(sessionId: string): Promise<Execution[]> {
    return Array.from(this.executions.values())
      .filter((execution) => execution.sessionId === sessionId)
      .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
  }

  // Task queue management methods
  async createTask(insertTask: InsertTask): Promise<Task> {
    const id = randomUUID();
    return this.createTaskWithId(id, insertTask);
  }

  async createTaskWithId(id: string, insertTask: InsertTask): Promise<Task> {
    const now = new Date();
    const task: Task = {
      ...insertTask,
      id,
      createdAt: now,
      updatedAt: now,
      processedAt: null,
      completedAt: null,
      failedAt: null,
      status: insertTask.status || "PENDING",
      priority: insertTask.priority || "MEDIUM",
      attempts: insertTask.attempts || "0",
      maxRetries: insertTask.maxRetries || "3",
      scheduledAt: insertTask.scheduledAt || new Date(),
    };
    this.tasks.set(id, task);
    return task;
  }

  async getTask(id: string): Promise<Task | undefined> {
    return this.tasks.get(id);
  }

  async updateTaskStatus(
    id: string, 
    status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED", 
    completedAt?: Date
  ): Promise<void> {
    const task = this.tasks.get(id);
    if (task) {
      task.status = status;
      task.updatedAt = new Date();
      
      if (status === "PROCESSING" && !task.processedAt) {
        task.processedAt = new Date();
      } else if (status === "COMPLETED") {
        task.completedAt = completedAt || new Date();
      } else if (status === "FAILED") {
        task.failedAt = completedAt || new Date();
      }
      
      this.tasks.set(id, task);
    }
  }

  async getSessionTasks(sessionId: string): Promise<Task[]> {
    return Array.from(this.tasks.values())
      .filter((task) => task.sessionId === sessionId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async getTasksByStatus(status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED"): Promise<Task[]> {
    return Array.from(this.tasks.values())
      .filter((task) => task.status === status)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  // Task result management methods
  async createTaskResult(insertTaskResult: InsertTaskResult): Promise<TaskResult> {
    const id = randomUUID();
    const taskResult: TaskResult = {
      ...insertTaskResult,
      id,
      createdAt: new Date(),
      logs: insertTaskResult.logs || null,
      result: insertTaskResult.result || null,
      error: insertTaskResult.error || null,
      duration: insertTaskResult.duration || null,
      workerInfo: insertTaskResult.workerInfo || null,
    };
    this.taskResults.set(id, taskResult);
    return taskResult;
  }

  async getTaskResult(taskId: string): Promise<TaskResult | undefined> {
    return Array.from(this.taskResults.values()).find(
      (result) => result.taskId === taskId
    );
  }
}

export const storage = new MemStorage();