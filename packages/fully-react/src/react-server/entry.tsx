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

function createDevRenderer() {
	let loader = setupWebpackEnv();

	const clientModuleMap = createModuleMapProxy();
	// need to polyfill crypto for react-server
	globalThis.crypto = webcrypto as any;

	const env = {
		loadModule: loader.load,
		clientModuleMap,
		findAssets: async () => {
			const { collectStyles } = await import("../server/dev/index");

			const styles = await collectStyles(viteDevServer, ["~/root"]);
			return [
				// @ts-ignore
				...Object.entries(styles ?? {}).map(([key, value]) => ({
					type: "style" as const,
					style: value,
					src: key,
				})),
			];
		},
		lazyComponent: (id: string) => {
			return lazy(() => import(/* @vite-ignore */ id));
		},
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
				response: {} as ResponseInit,
			},
			async () => {
				const { default: devServer } = await import("../dev-server");
				const { default: Root } = await devServer.ssrLoadModule("~/root");
				return renderToServerElementStream(
					<Root {...props} />,
					clientModuleMap,
					{
						onError: (error: Error) => {
							if (isNotFoundError(error) || isRedirectError(error)) {
								return error.digest;
							}
							console.log("Errror while React server render");
							console.log(error);
						},
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
				onError: (error: Error) => {
					if (isNotFoundError(error) || isRedirectError(error)) {
						return error.digest;
					}

					console.log(error);
				},
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
