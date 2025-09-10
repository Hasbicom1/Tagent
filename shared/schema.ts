import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Agent sessions for paid users
export const sessions = pgTable("sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: text("agent_id").notNull().unique(),
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

export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessions.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertExecution = z.infer<typeof insertExecutionSchema>;
export type Execution = typeof executions.$inferSelect;