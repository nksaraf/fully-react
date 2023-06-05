import { createElement, useMemo } from "react";

import { readFileSync } from "node:fs";

// Create a map of routes by parentId to use recursively instead of
// repeatedly filtering the manifest.
export function groupRoutesByParentId(
	/** @type {import('types').RouteManifest} */
	manifest,
) {
	/** @type {Record<string, import('types').RouteManifest[string][]>} */
	const routes = {};

	Object.values(manifest).forEach((route) => {
		const parentId = route.parentId || "";
		if (!routes[parentId]) {
			routes[parentId] = [];
		}
		routes[parentId].push(route);
	});

	return routes;
}

const isServer = typeof window === "undefined";

/**
 *
 * @param {import("types").RouteManifest} routeManifest
 * @param {*} parentId
 * @param {*} routesByParentId
 * @param {*} routerMode
 * @param {import('./ModuleLoader.js').ModuleLoader} loader
 * @returns
 */
export function createNestedPageRoutes(
	routeManifest,
	parentId = "",
	routesByParentId = groupRoutesByParentId(routeManifest || {}),
	routerMode,
	loader,
) {
	return (routesByParentId[parentId] || [])
		.map((/** @type {any} */ route) => {
			if (route.type === "route") {
				return undefined;
			}

			const path =
				(route.path?.length ?? 0) > 0 && route.path?.endsWith("/")
					? route.path.slice(0, -1)
					: route.path;

			const dataRoute = {
				id: route.id,
				path,
				caseSensitive: route.caseSensitive,
				/** @type {any[] | undefined} */
				children: undefined,
				index: route.index,
				file: route.file,
				component:
					typeof route.file === "string"
						? isServer
							? routerMode === "client"
								? (/** @type {any} */ props) => {
										const Component = useMemo(
											() => loader.lazy(route.file),
											[],
										);
										return createElement(Component, props);
								  }
								: (/** @type {any} */ props) => {
										const Component = loader.lazy(route.file);
										return createElement(Component, props);
								  }
							: loader.lazy(route.file)
						: loader.lazy(route.file),
			};

			const children = createNestedPageRoutes(
				routeManifest,
				route.id,
				routesByParentId,
				routerMode,
				loader,
			);
			if (children.length > 0) dataRoute.children = children;
			return dataRoute;
		})
		.filter(Boolean);
}

/**
 *
 * @param {string} path
 * @returns
 */
export function readJSON(path) {
	return JSON.parse(readFileSync(path, "utf-8"));
}
