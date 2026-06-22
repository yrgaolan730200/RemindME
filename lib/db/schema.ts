import { boolean, date, pgTable, serial, text, time, timestamp } from "drizzle-orm/pg-core"

export const todos = pgTable("todos", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  dueDate: date("due_date").notNull(),
  dueTime: time("due_time").notNull(),
  completed: boolean("completed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export type Todo = typeof todos.$inferSelect
