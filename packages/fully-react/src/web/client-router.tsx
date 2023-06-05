import createDebug from "@milahu/debug-esm";
import routeManifest from "app:react-routes";

import { createRouter } from "../app-router/client/router/app-router-client";
import { createNestedPageRoutes } from "../fs-router/nested";

function createApp() {
	const app = {
		pageRoutes: () => {
			return createNestedPageRoutes(
				{ routeManifest },
				"root",
				undefined,
				import.meta.env.APP_ROOT_DIR,
			);
		},
		debug: createDebug("app"),
		moduleLoader: {
			findAssetsForModules: async ([id]) => {
				const assets = await import(id + "?asset");
				return assets.default;
			},
		},
		ROOT_DIR: import.meta.env.APP_ROOT_DIR,
	};

	app.debug.enabled = true;
	// @ts-ignore
	window[Symbol.for("App")] = app;

	console.log(routeManifest);
	return app;
}

const app = createApp();
const Router = createRouter(app.pageRoutes());

const url = new URL(window.location.href);
export function AppRouter() {
	return (
		<Router
			url={url.href}
			headers={{}}
			params={{}}
			searchParams={Object.fromEntries(url.searchParams.entries())}
		/>
	);
}
