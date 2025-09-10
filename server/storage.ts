import { 
  type Session, 
  type InsertSession, 
  type Message, 
  type InsertMessage,
  type Execution,
  type InsertExecution 
} from "@shared/schema";
import { randomUUID } from "crypto";

// Storage interface for Agent HQ sessions
export interface IStorage {
  // Session management
  createSession(session: InsertSession): Promise<Session>;
  getSession(id: string): Promise<Session | undefined>;
  getSessionByAgentId(agentId: string): Promise<Session | undefined>;
  deactivateSession(id: string): Promise<void>;
  
  // Message management
  createMessage(message: InsertMessage): Promise<Message>;
  getSessionMessages(sessionId: string): Promise<Message[]>;
  
  // Execution management
  createExecution(execution: InsertExecution): Promise<Execution>;
  updateExecutionStatus(id: string, status: "running" | "completed" | "failed", logs?: string[], completedAt?: Date): Promise<void>;
  getSessionExecutions(sessionId: string): Promise<Execution[]>;
}

export class MemStorage implements IStorage {
  private sessions: Map<string, Session>;
  private messages: Map<string, Message>;
  private executions: Map<string, Execution>;

  constructor() {
    this.sessions = new Map();
    this.messages = new Map();
    this.executions = new Map();
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

  async getSessionExecutions(sessionId: string): Promise<Execution[]> {
    return Array.from(this.executions.values())
      .filter((execution) => execution.sessionId === sessionId)
      .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
  }
}

export const storage = new MemStorage();