async function fetchFromTMDB(endpoint: string, apiKey: string, params: Record<string, string> = {}) {
	const serchParams = new URLSearchParams({
		page: '1',
		include_adult: 'false',
		language: 'en-US',
		...params,
	});
	const response = await fetch(`http://api.themoviedb.org/3${endpoint}?${serchParams}`, {
		headers: { authorization: `Bearer ${apiKey}` },
	});

	if (!response.ok) {
		throw new Error('Could not fetch data');
	}
	return response.json();
}

type FindMovieFilters = {
	genreId?: number;
	minReleaseYear?: number;
	maxReleaseYear?: number;
	minRating?: number;
	maxRating?: number;
};

export function fetchUpcomingMovies(apikey: string) {
	return fetchFromTMDB('/movie/upcoming', apikey);
}

export function fetchNowPlayMovies(apikey: string) {
	return fetchFromTMDB('/movie/now_playing', apikey);
}

export function fetchSimilarMovies(apikey: string, movieId: number) {
	return fetchFromTMDB(`/movie/${movieId}/similar`, apikey);
}

export function fetchMovieReviews(apikey: string, movieId: number) {
	return fetchFromTMDB(`/movie/${movieId}/reivews`, apikey);
}

export function fetchMovieGenres(apikey: string) {
	return fetchFromTMDB('/genre/movie/list', apikey);
}

export function fetchMovieByGenre(apikey: string, genreId: number) {
	return fetchFromTMDB('/discover/movie', apikey, { with_genres: String(genreId), sort_by: 'popularity.desc' });
}

export function fetchhMovieDetails(apikey: string, movieId: number) {
	return fetchFromTMDB(`/movie/${movieId}`, apikey);
}

export function fetchFindMovie(apikey: string, filters: FindMovieFilters = {}) {
	const params: Record<string, string> = {};

	if (filters.minReleaseYear !== undefined) {
		params['primary_release_date.gte'] = `${filters.minReleaseYear}-01-01`;
	}
	if (filters.maxReleaseYear !== undefined) {
		params['primary_release_date.lte'] = `${filters.maxReleaseYear}-12-31`;
	}
	if (filters.minRating !== undefined) {
		params['vote_average.gte'] = String(filters.minRating);
	}
	if (filters.maxRating !== undefined) {
		params['vote_average.lte'] = String(filters.maxRating);
	}

	return fetchFromTMDB(`/discover/movie`, apikey, params);
}
