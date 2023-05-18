import type { Context } from "./context";
import { renderServerComponent } from "../component-server/render";

export async function createServerComponentResponse(
	component: string,
	props: any,
	env: Context,
	responseInit: ResponseInit = {},
) {
	const serverElement = await renderServerComponent(component, props, env);

	return new Response(serverElement, {
		...responseInit,
		headers: {
			"Content-Type": "text/x-component",
			...(responseInit.headers ?? {}),
		},
	});
}
