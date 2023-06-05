import { renderToReadableStream } from "react-server-dom-webpack/server.edge";

import type { AppContext } from "../app-context/context";

export async function createActionResponse(
	action: any,
	args: any,
	renderOptions: AppContext,
	responseInit: ResponseInit = {},
) {
	return new Response(
		renderToReadableStream(
			await action(...args),
			renderOptions.clientModuleMap,
		),
		{
			...responseInit,
			headers: {
				"Content-Type": "application/json",
				...(responseInit.headers ?? {}),
			},
		},
	);
}
