import { createElement, lazy, useMemo } from "react";
import type { Context } from "../server/context";
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

const isServer = typeof window === "undefined";

export function createNestedPageRoutes(
	env: Context,
	parentId = "",
	routesByParentId = groupRoutesByParentId(env.routeManifest || {}),
	routerMode: string,
): RouteObject[] {
	return (routesByParentId[parentId] || [])
		.map((route) => {
			if (route.type === "route") {
				return undefined as unknown as RouteObject;
			}

			const path =
				(route.path?.length ?? 0) > 0 && route.path?.endsWith("/")
					? route.path.slice(0, -1)
					: route.path;

			const dataRoute = {
				id: route.id,
				path,
				caseSensitive: route.caseSensitive,
				children: undefined as any,
				index: route.index,
				// @ts-ignore
				file: route.file,
				component:
					typeof route.file === "string"
						? isServer
							? routerMode === "client"
								? (props: any) => {
										const Component = useMemo(
											() => env.lazyComponent(route.file),
											[],
										);
										return createElement(Component, props);
								  }
								: (props: any) => {
										const Component = env.lazyComponent(route.file);
										return createElement(Component, props);
								  }
							: env.lazyComponent(route.file)
						: lazy(route.file),
			} satisfies RouteObject;

			const children = createNestedPageRoutes(
				env,
				route.id,
				routesByParentId,
				routerMode,
			);
			if (children.length > 0) dataRoute.children = children;
			return dataRoute;
		})
		.filter(Boolean);
}
