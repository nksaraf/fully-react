/// <reference lib="dom" />

import { createModuleMapProxy, setupWebpackEnv } from "../server/webpack";
import { isNotFoundError, isRedirectError } from "../shared/navigation";

import type { Env } from "../server/env";
import invariant from "tiny-invariant";
import { lazy } from "react";
import { renderToServerElementStream } from "./stream";
import { requestAsyncContext } from "../server/async-context";
import viteDevServer from "../dev-server";
import { webcrypto } from "node:crypto";
import { isNoSSRError } from "../client/dynamic/no-ssr-error";
import { createNestedPageRoutes } from "../fs-router/nested";
import { matchRoutes } from "../fs-router/utils";
import { relative } from "node:path";

function errorHandler(error: any) {
	if (isNotFoundError(error) || isRedirectError(error) || isNoSSRError(error)) {
		return error.digest;
	}

	console.log(error);
}

function createDevRenderer() {
	const loader = setupWebpackEnv((chunk) => {
		return viteDevServer.ssrLoadModule(/* @vite-ignore */ chunk);
	});

	const manifests = {
		mode: "dev" as const,
		routesManifest: viteDevServer.routesManifest,
	};

	const lazyComponent = (id: string) => {
		return lazy(() => viteDevServer.ssrLoadModule(id) as any);
	};
	const routes = createNestedPageRoutes(
		{
			manifests,
			lazyComponent,
		} as unknown as Env,
		"root",
		undefined,
		import.meta.env.ROUTER_MODE,
	);

	const inputs = matchRoutes(routes, "/")?.map((r) =>
		relative(import.meta.env.ROOT_DIR, r.route?.file!),
	);

	const clientModuleMap = createModuleMapProxy();
	// need to polyfill crypto for react-server
	globalThis.crypto = webcrypto as any;

	const env = {
		loadModule: loader.load,
		clientModuleMap,
		findAssets: async () => {
			const { collectStyles } = await import("../server/dev/index");

			const styles = await collectStyles(viteDevServer, inputs!);
			return [
				// @ts-ignore
				...Object.entries(styles ?? {}).map(([key, value]) => ({
					type: "style" as const,
					style: value,
					src: key,
				})),
			];
		},
		lazyComponent,
		manifests: {
			mode: "dev",
			routesManifest: viteDevServer.routesManifest,
		},
	} satisfies Env;

	globalThis.env = env;

	return async (src: string, props: any) => {
		return requestAsyncContext.run(
			{
				request: new Request(props.url, {
					headers: props.headers,
				}),
				internal: { response: {} as ResponseInit },
			},
			async () => {
				const { default: devServer } = await import("../dev-server");
				const { default: Root } = await devServer.ssrLoadModule(
					import.meta.env.APP_ROOT_ENTRY,
				);
				return renderToServerElementStream(
					<Root {...props} />,
					clientModuleMap,
					{
						onError: errorHandler,
					},
				);
			},
		);
	};
}

function createProdRenderer(env: Env) {
	// assumes an environment has been setup by the SSR handler
	return async (src: string, props: any, env: Env) => {
		invariant(env.manifests.mode === "build");
		const component = await import(
			"./" + env.manifests!.reactServerManifest["app/root.tsx"].file
		);
		return renderToServerElementStream(
			<component.default {...props} />,
			createModuleMapProxy(),
			{
				onError: errorHandler,
			},
		);
	};
}

export default async function (src: string, props: any, env: Env) {
	const render =
		process.env.NODE_ENV === "development"
			? createDevRenderer()
			: createProdRenderer(env);
	return await render(src, props, env);
}
