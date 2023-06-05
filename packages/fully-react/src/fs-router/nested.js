import { createElement, lazy, useMemo } from "react";

// Create a map of routes by parentId to use recursively instead of
// repeatedly filtering the manifest.
export function groupRoutesByParentId(manifest) {
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
 * @param {*} env
 * @param {*} parentId
 * @param {*} routesByParentId
 * @param {*} routerMode
 * @returns
 */
export function createNestedPageRoutes(
	env,
	parentId = "",
	routesByParentId = groupRoutesByParentId(env.routeManifest || {}),
	routerMode,
) {
	return (routesByParentId[parentId] || [])
		.map((route) => {
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
				children: undefined,
				index: route.index,
				// @ts-ignore
				file: route.file,
				component:
					typeof route.file === "string"
						? isServer
							? routerMode === "client"
								? (props) => {
										const Component = useMemo(() => env.lazy(route.file), []);
										return createElement(Component, props);
								  }
								: (props) => {
										const Component = env.lazy(route.file);
										return createElement(Component, props);
								  }
							: env.lazy(route.file)
						: route.file,
			};

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
