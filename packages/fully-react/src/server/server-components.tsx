import type { AppContext } from "../app-context/context";
import { renderServerComponent } from "../component-server/client-render";
import { App } from "../vite-app-router/App";

export async function createServerComponentResponse(
	component: string,
	props: any,
	env: App,
	responseInit: ResponseInit = {},
) {
	const serverElement = await env.fetchServerComponent(component, props);

	return new Response(serverElement, {
		...responseInit,
		headers: {
			"Content-Type": "text/x-component",
			...(responseInit.headers ?? {}),
		},
	});
}
