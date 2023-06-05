import routeManifest from "app:route-manifest";
import { lazy } from "react";

import { createNestedPageRoutes } from "../fs-router/nested";

export class ClientContext {
	routeManifest = routeManifest;

	pageRoutes() {
		return createNestedPageRoutes(
			this,
			"root",
			undefined,
			import.meta.env.ROUTER_MODE,
		);
	}

	lazyComponent(id: string) {
		const importPath = `/@fs${id}`;
		const importer = () => import(/* @vite-ignore */ importPath);
		return lazy(importer);
	}
}
