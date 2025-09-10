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