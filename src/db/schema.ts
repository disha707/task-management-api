import {
  pgTable,
  serial,
  varchar,
  boolean,
  timestamp,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const tasks = pgTable('tasks', {
  id: serial('id').primaryKey(),

  title: varchar('title', {
    length: 255,
  }).notNull(),

  description: varchar('description', {
    length: 1000,
  }),

  completed: boolean('completed')
    .default(false)
    .notNull(),

  createdAt: timestamp('created_at')
    .defaultNow()
    .notNull(),
});
