import { Measurer } from "../measurer";
import { createHTMLResponse } from "../react/html/html";
import { App } from "../vite-app-router/App";
import { requestAsyncContext } from "./async-context";

export async function handlePageRequest(request: Request, app: App) {
	const url = new URL(request.url);
	const responseInit: ResponseInit = {};
	const measurer = new Measurer();

	const response = await measurer.time(
		"createHTMLResponse",
		async () =>
			await requestAsyncContext.run(
				{ request, internal: { response: responseInit } },
				async () =>
					await app.fetch(
						new URL(import.meta.env.APP_ROOT_ENTRY, import.meta.url).href,
						{
							url: request.url,
							searchParams: Object.fromEntries(url.searchParams.entries()),
							headers: Object.fromEntries(request.headers.entries()),
							params: {},
						},
					),
			),
	);

	app.webServer.context.debug.server(
		"response",
		request.method,
		request.url,
		response.status,
		response.headers.get("content-type"),
	);

	const headers = new Headers(response.headers);

	(await measurer.toHeaders()).forEach((value, key) => {
		headers.set(key, value);
	});

	return new Response(response.body, {
		headers,
	});
}
