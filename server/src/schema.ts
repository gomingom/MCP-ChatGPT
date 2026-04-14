import { integer, text } from 'drizzle-orm/sqlite-core';
import { sqliteTable } from 'drizzle-orm/sqlite-core';
import crypto from 'node:crypto';
import { Exercise } from './index';

export const workouts = sqliteTable('workouts', {
	id: text()
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	title: text().notNull(),
	description: text().notNull(),
	durationMinutes: integer('duration_minutes').notNull(),
	intervalSeconds: integer('interval_seconds').notNull().default(60),
	exercises: text('exercises', { mode: 'json' }).$type<Exercise[]>().notNull(),
	exerciseCount: integer('exercise_count').notNull(),
	userId: text('user_id').notNull(),
	createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
});
