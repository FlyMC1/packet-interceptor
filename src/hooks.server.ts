import { init } from "$lib/server/protocol";

const originalFetch = globalThis.fetch.bind(globalThis);

globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
	const headers = new Headers(init?.headers);

	if (!headers.has("accept-encoding")) {
		headers.set("accept-encoding", "identity");
	}

	return originalFetch(input, {
		...init,
		headers
	});
}) as typeof fetch;

init();
