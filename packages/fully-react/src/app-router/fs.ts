import { lazy } from "react";
import { createNestedPageRoutes } from "../fs-router/nested";
import { createRouter } from "./server/create-router";
import routesManifest from "react:route-manifest";
import viteDevServer from "../dev-server";
import type { Env } from "../server/env";

const isServer = typeof window === "undefined";
const routes = createNestedPageRoutes(
	globalThis.env
		? globalThis.env
		: ({
				manifests: {
					routesManifest,
				},
				lazyComponent(id: string) {
					const importPath = `/@fs${id}`;
					const importer = () =>
						isServer
							? viteDevServer.ssrLoadModule(importPath)
							: import(/* @vite-ignore */ importPath);
					return lazy(importer);
				},
		  } as unknown as Env),
	"root",
);

export default createRouter(routes);
