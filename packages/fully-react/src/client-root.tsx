"use client";

import routeManifest from "app:react-routes";

import { createRouter } from "./app-router/client/router/app-router-client";
import { createNestedPageRoutes } from "./fs-router/nested";



function createClientRouter() {
	const Router = createRouter(
		createNestedPageRoutes(
			{
				routeManifest,
			},
			"root",
			undefined,
			import.meta.app.ROUTER_MODE,
		),
	);
	return Router;
}

export default createClientRouter();
