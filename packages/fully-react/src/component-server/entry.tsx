/// <reference lib="dom" />

import { createModuleMapProxy } from "../server/webpack";
import { isNotFoundError, isRedirectError } from "../shared/navigation";
import type { Context } from "../server/context";
import invariant from "tiny-invariant";
import { renderToServerElementStream } from "./stream";
import { requestAsyncContext } from "../server/async-context";
import { webcrypto } from "node:crypto";
import { isNoSSRError } from "../client/dynamic/no-ssr-error";
import { DevServerContext } from "../server/ServerContext";
import { relative } from "pathe";

function errorHandler(error: any) {
	if (isNotFoundError(error) || isRedirectError(error) || isNoSSRError(error)) {
		return error.digest;
	}

	console.log(error);
}

function createDevRenderer() {
	const context = new DevServerContext();
	context.setupWebpackEnv();

	// need to polyfill crypto for react-server
	globalThis.crypto = webcrypto as any;
	globalThis.context = context;

	return async (src: string, props: any) => {
		return requestAsyncContext.run(
			{
				request: new Request(props.url, {
					headers: props.headers,
				}),
				internal: { response: {} as ResponseInit },
			},
			async () => {
				const { default: Component } = await context.loadModule(src);
				return renderToServerElementStream(
					<Component {...props} context={context} />,
					context.clientModuleMap,
					{
						onError: errorHandler,
					},
				);
			},
		);
	};
}

function createProdRenderer() {
	// assumes an environment has been setup by the SSR handler
	return async (src: string, props: any, context: Context) => {
		// invariant(env.manifests.mode === "build");
		const { default: Component } = await context.loadModule(src);
		return renderToServerElementStream(
			<Component {...props} context={context} />,
			context.clientModuleMap,
			{
				onError: errorHandler,
			},
		);
	};
}

export default async function (
	component: string,
	props: any,
	context: Context,
) {
	const render =
		process.env.NODE_ENV === "development"
			? createDevRenderer()
			: createProdRenderer();

	return await render(component, props, context);
}
