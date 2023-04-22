import type { Env } from "./env";
import { renderToResultStream } from "../react-server/stream";

export async function createActionResponse(
	action: any,
	args: any,
	renderOptions: Env,
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
