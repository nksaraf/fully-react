import { lazy } from "react";

import type { AppContext } from "../app-context/context";
import routesManifest from "../conte";
import viteDevServer from "../dev-server";
import { createNestedPageRoutes } from "../fs-router/nested";
import { createRouter as createPageRouter } from "./server/create-router";

const isServer = typeof window === "undefined";
const routes = createNestedPageRoutes(
	globalThis.context
		? globalThis.context
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
		  } as unknown as AppContext),
	"root",
	undefined,
	import.meta.env.ROUTER_MODE,
);

export default createPageRouter(routes);
