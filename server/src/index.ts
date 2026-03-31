import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createMcpHandler } from 'agents/mcp';
import { z } from 'zod';
import {
	fetchFindMovie,
	fetchhMovieDetails,
	fetchMovieByGenre,
	fetchMovieGenres,
	fetchMovieReviews,
	fetchNowPlayMovies,
	fetchSimilarMovies,
	fetchUpcomingMovies,
} from './fetcher';

const findMovieInputSchema = z
	.object({
		minReleaseYear: z.number().int().min(1900).max(2100).optional().describe('The minimum release year of the movie to find.'),
		maxReleaseYear: z.number().int().min(1900).max(2100).optional().describe('The maximum release year of the movie to find.'),
		minRating: z.number().min(0).max(10).optional().describe('The minimum rating of the movie to find. (0-10).'),
		maxRating: z.number().min(0).max(10).optional().describe('The maximum rating of the movie to find. (0-10).'),
	})
	.refine(
		(input) => input.minReleaseYear === undefined || input.maxReleaseYear === undefined || input.minReleaseYear <= input.maxReleaseYear,
		{
			message: 'minReleaseYear must be less than or equal to maxReleaseYear.',
			path: ['minReleaseYear'],
		},
	)
	.refine((input) => input.minRating === undefined || input.maxRating === undefined || input.minRating <= input.maxRating, {
		message: 'minRating must be less than or equal to maxRating.',
		path: ['minRating'],
	});

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const server = new McpServer({
			name: 'Movies',
			version: '1.0',
		});

		const WIDGET_URI = 'ui://movie-widget';
		registerAppResource(server, 'Movies Widget', WIDGET_URI, { description: 'Movies widget' }, async () => {
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
			'get-upcoming-movies',
			{
				title: 'Get Upcoming Movies',
				description:
					'Use this tool when user wants to get movies that are going to be released soon or in the future. Do not use this tool for movies that are already released.',
				inputSchema: {},
				annotations: { readOnlyHint: true },
				_meta: {
					ui: {
						resourceUri: WIDGET_URI,
					},
					'openai/toolInvocation/invoking': 'Fetching upcomming movies',
					'openai/toolInvocation/invoked': 'Done.',
				},
			},
			async () => {
				const movies = await fetchUpcomingMovies(env.API_KEY);
				return {
					content: [{ text: JSON.stringify(movies), type: 'text' }],
					structuredContent: { movies },
				};
			},
		);
		registerAppTool(
			server,
			'get-now-playing-movies',
			{
				title: 'Get Now Playing Movies',
				description:
					'Use this tool when user wants to get movies that are currently playing in theaters. Do not use this for streaming movies or to check the availability of upcoming movices. Do not use this tool to find specific movides',
				inputSchema: {},
				annotations: { readOnlyHint: true },
				_meta: {
					ui: {
						resourceUri: WIDGET_URI,
					},
					'openai/toolInvocation/invoking': 'Fetching now playing movies',
					'openai/toolInvocation/invoked': 'Done.',
				},
			},
			async () => {
				const movies = await fetchNowPlayMovies(env.API_KEY);
				return {
					content: [{ text: JSON.stringify(movies), type: 'text' }],
					structuredContent: { movies },
				};
			},
		);

		registerAppTool(
			server,
			'get-similar-movies',
			{
				title: 'Get Similar Movies',
				description:
					'Use this tool when user wants to get movies that are similar to a specific movie. Requre the movie ID from the previous list. Do not use before identifying a specific movie.',
				inputSchema: {
					movieId: z
						.number()
						.positive()
						.describe(
							'The ID of the movie to get similar movies for. Obtained by calling order tools first like `get-upcoming-movies` or `get-now-playing-movies`',
						),
				},
				annotations: { readOnlyHint: true },
				_meta: {
					ui: {
						resourceUri: WIDGET_URI,
					},
					'openai/toolInvocation/invoking': 'Fetching similar movies',
					'openai/toolInvocation/invoked': 'Done.',
				},
			},
			async ({ movieId }) => {
				if (!movieId) {
					throw new Error('No movie ID provided');
				}
				const movies = await fetchSimilarMovies(env.API_KEY, movieId);
				return {
					content: [{ text: JSON.stringify(movies), type: 'text' }],
					structuredContent: { movies },
				};
			},
		);

		registerAppTool(
			server,
			'get-movie-reviews',
			{
				title: 'Get Movie Reviews',
				description:
					'Use this tool when user wants to get reviews for a specific movie. Requre the movie ID from the previous list. Do not use before identifying a specific movie. Do not use this for searching movies directly.',
				inputSchema: {
					movieId: z
						.number()
						.positive()
						.describe(
							'The ID of the movie to get reviews for. Obtained by calling order tools first like `get-upcoming-movies` or `get-now-playing-movies`',
						),
				},
				annotations: { readOnlyHint: true },
				_meta: {
					ui: {
						resourceUri: WIDGET_URI,
					},
					'openai/toolInvocation/invoking': 'Fetching movie reviews',
					'openai/toolInvocation/invoked': 'Done.',
				},
			},
			async ({ movieId }) => {
				if (!movieId) {
					throw new Error('No movie ID provided');
				}
				const reviews = await fetchMovieReviews(env.API_KEY, movieId);
				return {
					content: [{ text: JSON.stringify(reviews), type: 'text' }],
				};
			},
		);

		registerAppTool(
			server,
			'get-movie-genres',
			{
				title: 'Get Movie Genres',
				description:
					'Use this tool to get the list of genres ID. This should be used before calling `get-movies-by-genre` tool. Do not use this for searching movies directly.',
				inputSchema: {},
				annotations: { readOnlyHint: true },
				_meta: {
					ui: {
						resourceUri: WIDGET_URI,
					},
					'openai/toolInvocation/invoking': 'Fetching movie genres',
					'openai/toolInvocation/invoked': 'Done.',
				},
			},
			async () => {
				const genres = await fetchMovieGenres(env.API_KEY);
				return {
					content: [{ text: JSON.stringify(genres), type: 'text' }],
				};
			},
		);

		registerAppTool(
			server,
			'get-movies-by-genre',
			{
				title: 'Get Movies by Genre',
				description:
					'Use this tool when user wants to get movies that are of a specific genre. Use `get-movie-genres` first to get the list of genres IDs.',
				inputSchema: {
					genreId: z
						.number()
						.positive()
						.describe(
							'The ID of the genre to get movies for. Obtained by calling `get-movie-genres` tool. (example: 28 for Action, 99 for Documentary)',
						),
				},
				annotations: { readOnlyHint: true },
				_meta: {
					ui: {
						resourceUri: WIDGET_URI,
					},
					'openai/toolInvocation/invoking': 'Fetching movies by genre',
					'openai/toolInvocation/invoked': 'Done.',
				},
			},
			async ({ genreId }) => {
				const movies = await fetchMovieByGenre(env.API_KEY, genreId);
				return {
					content: [{ text: JSON.stringify(movies), type: 'text' }],
					structuredContent: { movies },
				};
			},
		);

		registerAppTool(
			server,
			'get-movie-details',
			{
				title: 'Get Movie Details',
				description:
					'Use this tool when user wants to get details for a specific movie. Details like synopsis, cast, director, production company, etc are available here. Requires the movie ID from the previous list. Do not use this for identifying a specific movie.',
				inputSchema: {
					movieId: z.number().positive().describe('The ID of the movie to find details for. Obtained by any of the list movie tools'),
				},
				annotations: { readOnlyHint: true },
				_meta: {
					ui: {
						resourceUri: WIDGET_URI,
					},
					'openai/toolInvocation/invoking': 'Fetching movie details',
					'openai/toolInvocation/invoked': 'Done.',
				},
			},
			async ({ movieId }) => {
				const movie = await fetchhMovieDetails(env.API_KEY, movieId);
				return {
					content: [{ text: JSON.stringify(movie), type: 'text' }],
					structuredContent: { movie },
				};
			},
		);

		registerAppTool(
			server,
			'find-movie',
			{
				title: 'Find Movie',
				description:
					'Use this tool when user wants to find a movie by filtering conditions. This tool will return a list of movies that match the conditions. Do not use this for identifying a specific movie.',
				inputSchema: findMovieInputSchema,
				annotations: { readOnlyHint: true },
				_meta: {
					ui: {
						resourceUri: WIDGET_URI,
					},
					'openai/toolInvocation/invoking': 'Finding movies by filtering conditions',
					'openai/toolInvocation/invoked': 'Done.',
				},
			},
			async ({ minReleaseYear, maxReleaseYear, minRating, maxRating }) => {
				const movies = await fetchFindMovie(env.API_KEY, {
					minReleaseYear,
					maxReleaseYear,
					minRating,
					maxRating,
				});
				return {
					content: [{ text: JSON.stringify(movies), type: 'text' }],
					structuredContent: { movies },
				};
			},
		);
		// @ts-ignore
		const handler = createMcpHandler(server);

		return handler(request, env, ctx);
	},
} satisfies ExportedHandler<Env>;
