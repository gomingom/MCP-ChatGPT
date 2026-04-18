import { integer, text } from 'drizzle-orm/sqlite-core';
import { sqliteTable } from 'drizzle-orm/sqlite-core';
import crypto from 'node:crypto';

export const workouts = sqliteTable('workouts', {});
