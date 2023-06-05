import { minimatch } from "minimatch";

import * as fs from "node:fs";
import * as path from "node:path";

// import { ConfigPageRoute, ConfigRoute, RouteManifest } from "./types";

// export interface DefineRouteOptions {
// 	/**
// 	 * Should be `true` if the route `path` is case-sensitive. Defaults to
// 	 * `false`.
// 	 */
// 	caseSensitive?: boolean;

// 	/**
// 	 * Should be `true` if this is an index route that does not allow child routes.
// 	 */
// 	index?: boolean;

// 	/**
// 	 * An optional unique id string for this route. Use this if you need to aggregate
// 	 * two or more routes with the same route file.
// 	 */
// 	id?: string;

// 	type?: "route" | "page";
// }

// interface DefineRouteChildren {
// 	(): void;
// }

/**
 * A function for defining a route that is passed as the argument to the
 * `defineRoutes` callback.
 *
 * Calls to this function are designed to be nested, using the `children`
 * callback argument.
 *
 *   defineRoutes(route => {
 *     route('/', 'pages/layout', () => {
 *       route('react-router', 'pages/react-router');
 *       route('reach-ui', 'pages/reach-ui');
 *     });
 *   });
 */
// export interface DefineRouteFunction {
// 	(
// 		/**
// 		 * The path this route uses to match the URL pathname.
// 		 */
// 		path: string | undefined,

// 		/**
// 		 * The path to the file that exports the React component rendered by this
// 		 * route as its default export, relative to the `app` directory.
// 		 */
// 		file: string,

// 		id: string,

// 		/**
// 		 * Options for defining routes, or a function for defining child routes.
// 		 */
// 		optionsOrChildren?: DefineRouteOptions | DefineRouteChildren,

// 		/**
// 		 * A function for defining child routes.
// 		 */
// 		children?: DefineRouteChildren,
// 	): void;
// }

// export type DefineRoutesFunction = typeof defineRoutes;

/**
 * A function for defining routes programmatically, instead of using the
 * filesystem convention.
 *
 * @param {(defineRoute: import('./types').DefineRouteFunction) => void} callback
 * @returns {import('./types').RouteManifest}
 */
export function defineRoutes(callback) {
	const routes = Object.create(null);
	/** @type {(import('./types').ConfigRoute | import('./types').ConfigPageRoute)[]} */
	const parentRoutes = [];
	let alreadyReturned = false;

	/** @type {import('./types').DefineRouteFunction} */
	const defineRoute = (path, file, id, optionsOrChildren, children) => {
		if (alreadyReturned) {
			throw new Error(
				"You tried to define routes asynchronously but started defining " +
					"routes before the async work was done. Please await all async " +
					"data before calling `defineRoutes()`",
			);
		}

		/** @type {import('./types').DefineRouteOptions} */
		let options;
		if (typeof optionsOrChildren === "function") {
			// route(path, file, children)
			options = {};
			children = optionsOrChildren;
		} else {
			// route(path, file, options, children)
			// route(path, file, options)
			options = optionsOrChildren || {};
		}

		/** @type {import('./types').ConfigRoute | import('./types').ConfigPageRoute} */
		const route =
			options.type === "route"
				? {
						path: path ? path : "",
						type: "route",
						id: id ?? createRouteId(file),
						file,
						parentId: "route-handler",
				  }
				: {
						path: path ? path : undefined,
						index: options.index ? true : undefined,
						caseSensitive: options.caseSensitive ? true : undefined,
						id: id ?? createRouteId(file),
						parentId:
							parentRoutes.length > 0
								? parentRoutes[parentRoutes.length - 1].id
								: "root",
						type: "page",
						file,
				  };

		if (route.id in routes) {
			throw new Error(
				`Unable to define routes with duplicate route id: "${route.id}"`,
			);
		}

		routes[route.id] = route;

		if (children) {
			parentRoutes.push(route);
			children();
			parentRoutes.pop();
		}
	};

	callback(defineRoute);

	alreadyReturned = true;

	return routes;
}

/**
 *
 * @param {string} file
 * @returns
 */
export function createRouteId(file) {
	file = file
		.replace("/page", "/")
		.replace("/route", "")
		.replace("/layout", "");
	return normalizeSlashes(stripFileExtension(file));
}

/**
 *
 * @param {string} file
 * @returns
 */
export function normalizeSlashes(file) {
	return file.split(path.win32.sep).join("/");
}

/**
 *
 * @param {string} file
 * @returns
 */
export function stripFileExtension(file) {
	return file.replace(/\.[a-z0-9]+$/i, "");
}

// /**
//  *
//  * @param {string} id
//  * @param {boolean} removePathlessLayouts
//  * @returns
//  */
// export function toPath(id, removePathlessLayouts = true) {
// 	const idWithoutIndex = id.endsWith("/index")
// 		? id.slice(0, -"index".length)
// 		: id;
// 	return (
// 		removePathlessLayouts
// 			? idWithoutIndex.replace(/\/\([^)/]+\)/g, "")
// 			: idWithoutIndex
// 	).replace(/\[([^\[]+)\]/g, (_, m) =>
// 		m.startsWith("...") ? `*${m.slice(3)}` : `:${m}`,
// 	);
// }

export const routeModuleExts = [".js", ".jsx", ".ts", ".tsx", ".md", ".mdx"];

/**
 *
 * @param {string} filename
 * @returns {boolean}
 */
function isRouteModuleFile(filename) {
	return (
		routeModuleExts.includes(path.extname(filename)) &&
		["route", "layout", "page"].includes(
			stripFileExtension(path.basename(filename)),
		)
	);
}

/**
 *
 * @param {string} id
 * @param {boolean} removePathlessLayouts
 * @returns
 */
export function toPath(id, removePathlessLayouts = true) {
	const idWithoutIndex = id.endsWith("/page")
		? id.slice(0, -"page".length)
		: id;

	const idWithoutRoute = idWithoutIndex.endsWith("/route")
		? idWithoutIndex.slice(0, -"/route".length)
		: idWithoutIndex;

	const idWithoutLayout = idWithoutRoute.endsWith("/layout")
		? idWithoutRoute.slice(0, -"/layout".length)
		: idWithoutRoute;
	return (
		removePathlessLayouts
			? idWithoutLayout.replace(/\([^)/]+\)/g, "")
			: idWithoutLayout
	).replace(/\[([^\[]+)\]/g, (_, m) => (m.startsWith("...") ? `*` : `:${m}`));
}

/**
 * Defines routes using the filesystem convention in `app/routes`. The rules are:
 *
 * - Route paths are derived from the file path. A `.` in the filename indicates
 *   a `/` in the URL (a "nested" URL, but no route nesting). A `$` in the
 *   filename indicates a dynamic URL segment.
 * - Subdirectories are used for nested routes.
 *
 * For example, a file named `app/routes/gists/$username.tsx` creates a route
 * with a path of `gists/:username`.
 *
 * @param {string} routesDir
 * @param {string[]} ignoredFilePatterns
 * @returns {import('./types').RouteManifest}
 */
export function defineFileSystemRoutes(
	routesDir,
	ignoredFilePatterns = ["**/*.css"],
) {
	/** @type {{ [routeId: string]: string }} */
	const files = {};

	// First, find all route modules in app/routes
	visitFiles(routesDir, (file) => {
		if (
			ignoredFilePatterns &&
			ignoredFilePatterns.some((pattern) => minimatch(file, pattern))
		) {
			return;
		}

		if (isRouteModuleFile(file)) {
			const routeId = createRouteId(`/` + file);
			files[routeId] = path.join(routesDir, file);
			return;
		}

		return;

		// throw new Error(`Invalid route module file: ${path.join(routesDir, file)}`);
	});

	const routeIds = Object.keys(files).sort(byLongestFirst);
	const parentRouteIds = getParentRouteIds(routeIds);

	/** @type {Map<string, string>} */
	const uniqueRoutes = new Map();

	// Then, recurse through all routes using the public defineRoutes() API
	/**
	 *
	 * @param {import('./types').DefineRouteFunction} defineRoute
	 * @param {string | undefined} parentId
	 */
	function defineNestedRoutes(defineRoute, parentId = undefined) {
		const childRouteIds = routeIds.filter(
			(id) => parentRouteIds[id] === parentId,
		);

		for (const routeId of childRouteIds) {
			const routePath = createRoutePath(
				routeId.slice(parentId ? parentId.length + 1 : 0),
			);

			const isRouteHandler = stripFileExtension(files[routeId]).endsWith(
				"/route",
			);
			const isIndexRoute = routeId.endsWith("/") || isRouteHandler;
			const fullPath = createRoutePath(routeId);
			const uniqueRouteId = (fullPath || "") + (isIndexRoute ? "?index" : "");

			if (uniqueRouteId) {
				if (uniqueRoutes.has(uniqueRouteId)) {
					throw new Error(
						`Path ${JSON.stringify(fullPath)} defined by route ${JSON.stringify(
							routeId,
						)} conflicts with route ${JSON.stringify(
							uniqueRoutes.get(uniqueRouteId),
						)}`,
					);
				} else {
					uniqueRoutes.set(uniqueRouteId, routeId);
				}
			}

			if (isIndexRoute) {
				const invalidChildRoutes = routeIds.filter(
					(id) => parentRouteIds[id] === routeId,
				);

				if (invalidChildRoutes.length > 0) {
					throw new Error(
						`Child routes are not allowed in index routes. Please remove child routes of ${routeId}`,
					);
				}

				defineRoute(routePath, files[routeId], routeId, {
					index: true,
					type: isRouteHandler ? "route" : "page",
				});
			} else {
				defineRoute(routePath, files[routeId], routeId, () => {
					defineNestedRoutes(defineRoute, routeId);
				});
			}
		}
	}

	return defineRoutes(defineNestedRoutes);
}

/**
 *
 * @param {string} partialRouteId
 */
export function createRoutePath(partialRouteId) {
	return toPath(partialRouteId) ?? "/";
}

/**
 *
 * @param {string | undefined} checkChar
 */
export function isSegmentSeparator(checkChar) {
	if (!checkChar) return false;
	return ["/", ".", path.win32.sep].includes(checkChar);
}

/**
 *
 * @param {string[]} routeIds
 * @returns {{ [routeId: string]: string }}
 */
function getParentRouteIds(routeIds) {
	return routeIds.reduce(
		(parentRouteIds, childRouteId) => ({
			...parentRouteIds,
			[childRouteId]: routeIds.find((id) => childRouteId.startsWith(`${id}/`)),
		}),
		{},
	);
}

/**
 *
 * @param {string} a
 * @param {string} b
 * @returns
 */
function byLongestFirst(a, b) {
	return b.length - a.length;
}

/**
 *
 * @param {string} dir
 * @param {(file: string) => void} visitor
 * @param {string} baseDir
 */
function visitFiles(dir, visitor, baseDir = dir) {
	for (const filename of fs.readdirSync(dir)) {
		const file = path.resolve(dir, filename);
		const stat = fs.lstatSync(file);

		if (stat.isDirectory()) {
			visitFiles(file, visitor, baseDir);
		} else if (stat.isFile()) {
			visitor(path.relative(baseDir, file));
		}
	}
}

/*
eslint
  no-loop-func: "off",
*/
