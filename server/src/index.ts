import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createMcpHandler } from 'agents/mcp';
import { z } from 'zod';

const WIDGET_URI = 'ui://flashcards-widget';

const cardSchema = z.object({
	front: z.string().describe('The question or prompt'),
	back: z.string().describe('The answer or response'),
	hint: z.string().describe('A hint for the answer. e.g "React is a library for building user interfaces."'),
	status: z
		.enum(['new', 'learning', 'mastered'])
		.describe('The status of the card. e.g "new", "learning", "mastered"')
		.readonly()
		.default('new'),
});

const deckSchema = z.object({
	title: z.string().describe('The title of the deck. e.g "React Fundamentals"'),
	description: z.string().describe('The description of the deck. e.g "A deck of flashcards for studying React Fundamentals"'),
	cards: z
		.array(cardSchema)
		.min(10)
		.max(20)
		.describe(
			'Array of flashcards (aim for 20.) e.g [{ "front": "What is React?", "back": "React is a library for building user interfaces.", "hint": "React is a library for building user interfaces." }]',
		),
});

type Deck = z.infer<typeof deckSchema>;
type Card = z.infer<typeof cardSchema>;

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const server = new McpServer({
			name: 'Flashcard server',
			version: '1.0',
		});

		registerAppResource(server, 'Flashcards Widget', WIDGET_URI, { description: 'Flashcards widget' }, async () => {
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
									],
								},
							},
						},
					},
				],
			};
		});

		registerAppTool(
			server,
			'create-deck',
			{
				title: 'Create Deck',
				description:
					'Use this to create a deck of flashcards for studying a specific topic. Generate 20 cards, with front (question) and back (answer) with hint as well. Ask the user for their uesername before using this tool.',
				inputSchema: z.object({
					username: z.string().describe('The username of the user creating the deck. Ask for this before using this tool.'),
					deck: deckSchema,
				}),
				annotations: { readOnlyHint: true },
				_meta: {
					ui: {
						resourceUri: WIDGET_URI,
					},
				},
			},
			async ({ deck: { title, description, cards }, username }) => {
				const cardWithIds = cards.map((card, index) => ({
					id: `card-${Date.now()}-${index}`,
					...card,
					status: 'new',
				}));
				const deck = {
					id: `deck-${Date.now()}`,
					title,
					description,
					cards: cardWithIds,
					createdAt: new Date().toISOString(),
				};

				const decksKey = `user:${username}:decks`;

				await env.FLASHCARDS_KV.put(`user:${username}:deck:${deck.id}`, JSON.stringify(deck));

				const existingIds = await env.FLASHCARDS_KV.get<string[]>(decksKey, 'json');

				const deckIds = existingIds || [];

				deckIds.push(deck.id);

				await env.FLASHCARDS_KV.put(decksKey, JSON.stringify(deckIds));

				return {
					content: [
						{
							type: 'text',
							text: `Created a ${title} deck with ${cards.length} flashcards.`,
						},
					],
					structuredContent: {
						deck,
						username,
					},
				};
			},
		);

		registerAppTool(
			server,
			'list-decks',
			{
				title: 'List Decks',
				description:
					'Use this to show the user a list of thier decks. Ask the user for their username before using this tool if you dont know it. ',
				inputSchema: z.object({}),
				annotations: { readOnlyHint: true },
				_meta: {
					ui: {
						resourceUri: WIDGET_URI,
					},
				},
			},
			async ({ username }) => {
				const decksKey = `user:${username}:decks`;

				const deckIds = await env.FLASHCARDS_KV.get<string[]>(decksKey, 'json');

				if (!deckIds || deckIds.length === 0) {
					return {
						content: [{ text: 'You have no decks', type: 'text' }],
					};
				}
				const decks = [];

				for (const deckId of deckIds) {
					const deck = await env.FLASHCARDS_KV.get<Deck>(`user:${username}:deck:${deckId}`, 'json');
					if (deck) {
						const masteredCount = deck.cards.filter((card) => card.status === 'mastered').length;
						decks.push({ masteredCount, ...deck });
					}
				}

				await env.FLASHCARDS_KV.put(decksKey, JSON.stringify(deckIds));

				return {
					content: [
						{
							type: 'text',
							text: `Found a total of ${decks.length} decks.`,
						},
					],
					structuredContent: {
						decks,
						username,
					},
				};
			},
		);
		// @ts-ignore
		const handler = createMcpHandler(server);

		return handler(request, env, ctx);
	},
} satisfies ExportedHandler<Env>;
