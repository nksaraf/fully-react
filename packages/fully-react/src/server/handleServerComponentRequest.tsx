import { App } from "../vite-app-router/App";
import { requestAsyncContext } from "./async-context";
import { createServerComponentResponse } from "./server-components";

export async function handleServerComponentRequest(
	request: Request,
	context: App,
) {
	const cleanedUrl = request.url.replace(/\.rsc$/, "");
	const url = new URL(request.headers.get("x-navigate") ?? "/", cleanedUrl);
	const currentRouterState = JSON.parse(
		request.headers.get("x-router") ?? "null",
	);
	const response: ResponseInit = {};
	return requestAsyncContext.run({ request, internal: { response } }, () =>
		createServerComponentResponse(
			import.meta.env.APP_ROOT_ENTRY,
			{
				url: cleanedUrl,
				searchParams: Object.fromEntries(url.searchParams.entries()),
				headers: Object.fromEntries(request.headers.entries()),
				params: {},
				currentRouterState,
			},
			context,
			response,
		),
	);
}
