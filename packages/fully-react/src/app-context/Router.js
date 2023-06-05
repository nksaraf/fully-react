import { matchRoutes } from "./match";
import { createNestedPageRoutes } from "./nested-router";
import { createLocation, createPath } from "./path";

export class Router {
	/** @type {import('./ModuleLoader.js').ModuleLoader} */
	loader;

	/** @type {import('types').RouteManifest} */
	routeManifest;

	/**
	 *
	 * @param {import("types").RouteManifest} routeManifest
	 * @param {import('./ModuleLoader.js').ModuleLoader} loader
	 */
	constructor(routeManifest, loader) {
		this.routeManifest = routeManifest;
		this.loader = loader;
	}
	/**
	 * @return {Record<string, any>}
	 */
	getRouteHandlers() {
		return Object.fromEntries(
			Object.entries(this.routeManifest).filter(
				([key, value]) => value.type === "route",
			),
		);
	}

	/**
	 * @param {string} url
	 * @return {[import('./path').Location, import('./match').RouteMatch[] | null]}
	 *
	 */
	matchRoutes(url) {
		const basename = "/";
		const location = createLocation(
			"",
			createPath(new URL(url)),
			null,
			"default",
		);
		return [location, matchRoutes(this.pageRoutes(), location, basename)];
	}

	pageRoutes() {
		let pageRoutes = createNestedPageRoutes(
			this.routeManifest,
			"root",
			undefined,
			import.meta.env.ROUTER_MODE,
			this.loader,
		);

		return pageRoutes;
	}
}
