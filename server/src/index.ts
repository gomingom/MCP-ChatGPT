import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createMcpHandler } from 'agents/mcp';
import { z } from 'zod';
import crypto from 'node:crypto';
import { drizzle } from 'drizzle-orm/d1';
import { workouts } from './schema';
import { desc, eq } from 'drizzle-orm';

const WIDGET_URI = 'ui://workouts-widget';

const exercisesSchema = z.object({
	name: z.string().describe('The name of the exercise.'),
	reps: z.number().describe('The number of reps for the exercise.'),
	instructions: z.string().describe('The instructions for the exercise.'),
	searchKeyword: z.string().describe('The YouTube search keyword for the exercise. ').optional(),
});

export type Exercise = z.infer<typeof exercisesSchema>;

const corsHeaders = {
	'Access-Control-Allow-Origin': '*', // 특정 도메인만 허용하려면 해당 URL 입력
	'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type',
};
const headers = new Headers(corsHeaders);
export default {
	async fetch(request, env, ctx): Promise<Response> {
		if (request.method === 'OPTIONS') {
			return new Response('OK', { headers });
		}
		const server = new McpServer({
			name: 'Workouts server',
			version: '1.0',
		});

		registerAppResource(server, 'Workouts Widget', WIDGET_URI, { description: 'Workouts widget' }, async () => {
			const html = await env.ASSETS.fetch(new URL('http://test-fetch-from-assets.com/index.html'));
			return {
				contents: [
					{
						uri: WIDGET_URI,
						text: await html.text(),
						mimeType: RESOURCE_MIME_TYPE,
						_meta: {
							ui: {
								csp: {
									connectDomains: ['https://*.workers.dev'],
									resourceDomains: [
										'https://*.workers.dev',
										'https://fonts.googleapis.com',
										'https://fonts.gstatic.com',
										'https://image.tmdb.org',
										'https://cdn.openai.com',
									],
								},
							},
						},
					},
				],
			};
		});
		// Create Workout Tool
		registerAppTool(
			server,
			'create-workout',
			{
				title: 'Create EMOM Workout',
				description:
					'Use this to create workout for EMOM (Every Minute On the Minute) training. Generate 5-10 exercises, with 30-60 seconds rest between each exercise. Ask the user for the duration of the workout in minutes. Each exercise needs a name, reps, instructions, and optinally a YouTube search keyword for form tutorials.',
				inputSchema: z.object({
					userId: z.string().describe("The user's username. Ask the user for this before using this tool."),
					title: z.string().describe('The title of the workout.'),
					description: z.string().describe('The description of the workout.'),
					durationMinutes: z.number().describe('The duration of the workout in minutes.').min(1).max(60),
					intervalSeconds: z.number().describe('The interval between exercises in seconds.').min(10).max(120).default(60),
					exercises: z.array(exercisesSchema).min(5).max(10).describe('The exercises for the workout.'),
				}),
				annotations: { readOnlyHint: false },
				_meta: {
					ui: {
						resourceUri: WIDGET_URI,
					},
				},
			},
			async ({ userId, title, description, durationMinutes, intervalSeconds, exercises }) => {
				const db = drizzle(env.DB);

				const [result] = await db
					.insert(workouts)
					.values({
						userId,
						title,
						description,
						durationMinutes,
						intervalSeconds,
						exercises,
						exerciseCount: exercises.length,
					})
					.returning();
				return {
					content: [
						{
							type: 'text',
							text: `Created a "${title}" \n Workout id: "${result.id}" \nDescription: ${result.description}`,
						},
					],
					structuredContent: {
						workout: result,
					},
				};
			},
		);

		// Get Workouts Tool
		registerAppTool(
			server,
			'get-workouts',
			{
				title: 'Get Workouts',
				description:
					'Use this to get all workouts for a user. Ask the user for their username before using this tool if you do not have it.',
				inputSchema: z.object({
					userId: z.string().describe("The user's username. Ask the user for this before using this tool."),
				}),
				annotations: { readOnlyHint: false },
				_meta: {
					ui: {
						resourceUri: WIDGET_URI,
					},
				},
			},
			async ({ userId }) => {
				const db = drizzle(env.DB);
				const result = await db
					.select({
						id: workouts.id,
						title: workouts.title,
						description: workouts.description,
						durationMinutes: workouts.durationMinutes,
						intervalSeconds: workouts.intervalSeconds,
						exerciseCount: workouts.exerciseCount,
					})
					.from(workouts)
					.where(eq(workouts.userId, userId))
					.orderBy(workouts.createdAt);

				if (result.length === 0) {
					return {
						content: [
							{
								type: 'text',
								text: 'No workouts found for user.',
							},
						],
					};
				}

				const formattedResult = result.map(
					(workout) =>
						`id: ${workout.id} \nTitle: ${workout.title} \nDescription: ${workout.description} \nDuration: ${workout.durationMinutes} minutes \nInterval: ${workout.intervalSeconds} seconds \nExercise Count: ${workout.exerciseCount}\n\n========================================\n\n`,
				);
				return {
					content: [
						{
							type: 'text',
							text: `Found ${result.length} workouts for user: \n\n${formattedResult}`,
						},
					],
					structuredContent: {
						workouts: result,
					},
				};
			},
		);

		// Get specific workout tool
		registerAppTool(
			server,
			'get-workout',
			{
				title: 'View Workout',
				description:
					'Use this to get a specific workout with all its exercises. The widget shows a Start Workout button that opens a fullscreen timer session.',
				inputSchema: z.object({
					workoutId: z.string().describe("The workout's id. Ask the user for this before using this tool if you do not have it."),
				}),
				annotations: { readOnlyHint: false },
				_meta: {
					ui: {
						resourceUri: WIDGET_URI,
					},
				},
			},
			async ({ workoutId }) => {
				const db = drizzle(env.DB);
				const [result] = await db.select().from(workouts).where(eq(workouts.id, workoutId)).limit(1);

				if (result === undefined) {
					return {
						content: [
							{
								type: 'text',
								text: 'No workout found with the given id.',
							},
						],
					};
				}

				return {
					content: [
						{
							type: 'text',
							text: `Viewing "${result.title}" - ${result.durationMinutes} min workout with ${result.exerciseCount} exercises.`,
						},
					],
					structuredContent: {
						workout: result,
					},
				};
			},
		);

		// Delete workout tool
		registerAppTool(
			server,
			'delete-workout',
			{
				title: 'Delete Workout',
				description:
					'Use this to delete a specific workout for a user. The widget shows a Delete Workout button that deletes the workout and all its exercises.',
				inputSchema: z.object({
					workoutId: z.string().describe("The workout's id. Ask the user for this before using this tool if you do not have it."),
				}),
				annotations: { readOnlyHint: false },
				_meta: {
					ui: {
						resourceUri: WIDGET_URI,
					},
				},
			},
			async ({ workoutId }) => {
				const db = drizzle(env.DB);
				await db.delete(workouts).where(eq(workouts.id, workoutId));

				return {
					content: [
						{
							type: 'text',
							text: `Deleted workout with id: "${workoutId}".`,
						},
					],
				};
			},
		);

		// Complete workout tool
		registerAppTool(
			server,
			'complete-workout',
			{
				title: 'Complte Workout',
				description:
					'Use this to complete a specific workout for a user. The widget shows a Complete Workout button that completes the workout and all its exercises.',
				inputSchema: z.object({
					workoutId: z.string().describe("The workout's id. Ask the user for this before using this tool if you do not have it."),
					roundsCompleted: z.number().describe('The number of rounds completed for the workout.'),
				}),
				annotations: { readOnlyHint: false },
				_meta: {
					ui: {
						resourceUri: WIDGET_URI,
					},
				},
			},
			async ({ workoutId, roundsCompleted }) => {
				const db = drizzle(env.DB);
				const [result] = await db.select().from(workouts).where(eq(workouts.id, workoutId)).limit(1);

				if (result === undefined) {
					return {
						content: [
							{
								type: 'text',
								text: 'No workout found with the given id.',
								isError: true,
							},
						],
					};
				}
				const summary = result.exercises.map((exercise) => `${exercise.name} - ${exercise.reps} reps`).join(', ');

				const response = (await env.AI.run('@cf/zai-org/glm-4.7-flash' as keyof AiModels, {
					messages: [
						{
							role: 'system',
							content:
								'You are a fitness calories calculator. Reply only with single integer representing the calories burned from the workout. No text, no units, nothing else than a single integer.',
						},
						{
							role: 'user',
							content: `I did an EMOM workout. Here is exactly how much I exercised:\n\n
							- Round completed ${roundsCompleted}\n
							 Exercises per round: ${summary}\n`,
						},
					],
				})) as any;

				const calories = response.choices[0].message.content;
				return {
					content: [
						{
							type: 'text',
							text: `Completed ${roundsCompleted} rounds for workout. Calories burned: ${calories}`,
						},
					],
					structuredContent: {
						calories: parseInt(calories, 10),
					},
				};
			},
		);

		// @ts-ignore
		const handler = createMcpHandler(server);

		return handler(request, env, ctx);
	},
} satisfies ExportedHandler<Env>;
