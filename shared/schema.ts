import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Agent sessions for paid users
export const sessions = pgTable("sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: text("agent_id").notNull().unique(),
  checkoutSessionId: text("checkout_session_id").notNull().unique(),
  stripePaymentIntentId: text("stripe_payment_intent_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
});

// Chat messages within sessions
export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").references(() => sessions.id).notNull(),
  role: text("role", { enum: ["user", "agent"] }).notNull(),
  content: text("content").notNull(),
  messageType: text("message_type", { enum: ["chat", "command", "system"] }).notNull().default("chat"),
  inputMethod: text("input_method", { enum: ["typing", "button", "slash_command"] }).default("typing"),
  hasExecutableTask: boolean("has_executable_task").default(false),
  taskDescription: text("task_description"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

// Task executions
export const executions = pgTable("executions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").references(() => sessions.id).notNull(),
  taskDescription: text("task_description").notNull(),
  status: text("status", { enum: ["running", "completed", "failed"] }).notNull(),
  logs: text("logs").array(),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

// Task queue system for scalable browser automation
export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").references(() => sessions.id).notNull(),
  agentId: text("agent_id").notNull(),
  type: text("type", { enum: ["BROWSER_AUTOMATION", "SESSION_START", "SESSION_END"] }).notNull(),
  status: text("status", { enum: ["PENDING", "PROCESSING", "COMPLETED", "FAILED"] }).notNull().default("PENDING"),
  payload: json("payload").notNull(),
  priority: text("priority", { enum: ["LOW", "MEDIUM", "HIGH"] }).notNull().default("MEDIUM"),
  attempts: text("attempts").default("0").notNull(),
  maxRetries: text("max_retries").default("3").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  scheduledAt: timestamp("scheduled_at").defaultNow().notNull(),
  processedAt: timestamp("processed_at"),
  completedAt: timestamp("completed_at"),
  failedAt: timestamp("failed_at"),
});

// Task results for completed tasks
export const taskResults = pgTable("task_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").references(() => tasks.id).notNull(),
  result: json("result"),
  error: text("error"),
  logs: text("logs").array(),
  duration: text("duration"),
  workerInfo: json("worker_info"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Schema exports
export const insertSessionSchema = createInsertSchema(sessions).omit({
  id: true,
  createdAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  timestamp: true,
});

export const insertExecutionSchema = createInsertSchema(executions).omit({
  id: true,
  startedAt: true,
  completedAt: true,
});

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  processedAt: true,
  completedAt: true,
  failedAt: true,
});

export const insertTaskResultSchema = createInsertSchema(taskResults).omit({
  id: true,
  createdAt: true,
});

export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessions.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertExecution = z.infer<typeof insertExecutionSchema>;
export type Execution = typeof executions.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;
export type InsertTaskResult = z.infer<typeof insertTaskResultSchema>;
export type TaskResult = typeof taskResults.$inferSelect;

// SECURITY ENHANCEMENT: Comprehensive API Request/Response Validation Schemas
export const createCheckoutSessionSchema = z.object({
  csrfToken: z.string().min(16, "CSRF token required for security")
});

export const checkoutSuccessSchema = z.object({
  sessionId: z.string()
    .min(20, "Liberation session ID too short")
    .max(200, "Liberation session ID too long")
    .refine(id => /^cs_[a-zA-Z0-9_-]+$/.test(id), "Invalid Stripe session ID format"),
  csrfToken: z.string().min(16, "CSRF token required for security")
});

export const sessionMessageSchema = z.object({
  content: z.string()
    .min(1, "Neural transmission cannot be empty")
    .max(2000, "Neural transmission too long - max 2000 characters"),
  csrfToken: z.string().min(16, "CSRF token required for security")
});

export const sessionExecuteSchema = z.object({
  taskDescription: z.string()
    .min(1, "Task description required")
    .max(1000, "Task description too long - max 1000 characters"),
  csrfToken: z.string().min(16, "CSRF token required for security")
});

export const browserCommandSchema = z.object({
  command: z.string()
    .min(1, "Command required")
    .max(500, "Command too long - max 500 characters"),
  timestamp: z.string().datetime().optional(),
  csrfToken: z.string().min(16, "CSRF token required for security")
});

// Parameter validation schemas for route params
export const agentIdSchema = z.string()
  .regex(/^[a-zA-Z0-9_-]+$/, "Invalid agent ID format")
  .max(50, "Agent ID too long");

export const sessionIdSchema = z.string()
  .regex(/^[a-zA-Z0-9_-]+$/, "Invalid session ID format")
  .max(50, "Session ID too long");

// API Request/Response Types
export type CreateCheckoutSessionRequest = z.infer<typeof createCheckoutSessionSchema>;
export type CheckoutSuccessRequest = z.infer<typeof checkoutSuccessSchema>;
export type SessionMessageRequest = z.infer<typeof sessionMessageSchema>;
export type SessionExecuteRequest = z.infer<typeof sessionExecuteSchema>;
export type BrowserCommandRequest = z.infer<typeof browserCommandSchema>;