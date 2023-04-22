import type { Env } from "./env";
import type { RenderToReadableStreamOptions } from "react-dom/server.edge";
import { renderServerComponent } from "../react-server/render";

export async function createServerComponentResponse(
	component: string,
	props: any,
	env: RenderToReadableStreamOptions & Env,
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
