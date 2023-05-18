import routeManifest from "react:route-manifest";
import { createNestedPageRoutes } from "../fs-router/nested";
import { lazy } from "react";

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
