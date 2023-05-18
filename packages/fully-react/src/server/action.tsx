import type { Context } from "./context";
import { renderToResultStream } from "../component-server/stream";

export async function createActionResponse(
	action: any,
	args: any,
	renderOptions: Context,
	responseInit: ResponseInit = {},
) {
	return new Response(
		renderToResultStream(await action(...args), renderOptions.clientModuleMap),
		{
			...responseInit,
			headers: {
				"Content-Type": "application/json",
				...(responseInit.headers ?? {}),
			},
		},
	);
}
