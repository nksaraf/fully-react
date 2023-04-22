import { Env } from "../server/env";
import type { RouteManifest } from "./types";
import { RouteObject } from "./utils";

// Create a map of routes by parentId to use recursively instead of
// repeatedly filtering the manifest.
export function groupRoutesByParentId(manifest: RouteManifest) {
	const routes: Record<string, RouteManifest[string][]> = {};

	Object.values(manifest).forEach((route) => {
		const parentId = route.parentId || "";
		if (!routes[parentId]) {
			routes[parentId] = [];
		}
		routes[parentId].push(route);
	});

	return routes;
}

export function createNestedPageRoutes(
	env: Env,
	parentId = "",
	routesByParentId = groupRoutesByParentId(env.manifests?.routesManifest || {}),
): RouteObject[] {
	return (routesByParentId[parentId] || [])
		.map((route) => {
			if (route.type === "route") {
				return undefined as unknown as RouteObject;
			}

			const dataRoute = {
				id: route.id,
				path: route.path,
				caseSensitive: route.caseSensitive,
				children: undefined as any,
				index: route.index,
				component: env.lazyComponent(route.file),
			} satisfies RouteObject;

			const children = createNestedPageRoutes(env, route.id, routesByParentId);
			if (children.length > 0) dataRoute.children = children;
			return dataRoute;
		})
		.filter(Boolean);
}
