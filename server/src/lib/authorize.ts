export default async function handleAuthorize(request: Request, env: Env, ctx: ExecutionContext) {
	const url = new URL(request.url);
	const clientId = url.searchParams.get('client_id');
	if (!clientId) {
		return new Response(null, { status: 400 });
	}
	const client = await env.OAUTH_PROVIDER.lookupClient(clientId);
	return new Response(JSON.stringify(client));
}
