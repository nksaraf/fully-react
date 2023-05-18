/**
 * MIT License
 *
 * Copyright (c) React Training 2015-2019
 * Copyright (c) Remix Software 2020-2022
 */

import type { Path, To } from "../../../fs-router/path";

import { parsePath } from "../../../fs-router/path";

/**
 * @private
 */
export function invariant(value: boolean, message?: string): asserts value;
export function invariant<T>(
	value: T | null | undefined,
	message?: string,
): asserts value is T;
export function invariant(value: any, message?: string) {
	if (value === false || value === null || typeof value === "undefined") {
		throw new Error(message);
	}
}

export function warning(cond: any, message: string) {
	if (!cond) {
		// eslint-disable-next-line no-console
		if (typeof console !== "undefined") console.warn(message);

		try {
			// Welcome to debugging history!
			//
			// This error is thrown as a convenience so you can more easily
			// find the source for a warning that appears in the console by
			// enabling "pause on exceptions" in your JavaScript debugger.
			throw new Error(message);
			// eslint-disable-next-line no-empty
		} catch (e) {}
	}
}

/**
 * Map of routeId -> data returned from a loader/action/error
 */
export interface RouteData {
	[routeId: string]: any;
}

type LowerCaseFormMethod = "get" | "post" | "put" | "patch" | "delete";
type UpperCaseFormMethod = Uppercase<LowerCaseFormMethod>;

/**
 * Users can specify either lowercase or uppercase form methods on <Form>,
 * useSubmit(), <fetcher.Form>, etc.
 */
export type HTMLFormMethod = LowerCaseFormMethod | UpperCaseFormMethod;

/**
 * Active navigation/fetcher form methods are exposed in lowercase on the
 * RouterState
 */

export type FormMethod = UpperCaseFormMethod;
export type MutationFormMethod = Exclude<FormMethod, "GET">;

export type FormEncType =
	| "application/x-www-form-urlencoded"
	| "multipart/form-data";

/**
 * @private
 * Internal interface to pass around for action submissions, not intended for
 * external consumption
 */
export interface Submission {
	formMethod: FormMethod;
	formAction: string;
	formEncType: FormEncType;
	formData: FormData;
}

/**
 * @private
 * Arguments passed to route loader/action functions.  Same for now but we keep
 * this as a private implementation detail in case they diverge in the future.
 */
interface DataFunctionArgs {
	request: Request;
	params: Params;
	context?: any;
}

/**
 * Arguments passed to loader functions
 */
export type LoaderFunctionArgs = DataFunctionArgs;

/**
 * Arguments passed to action functions
 */
export type ActionFunctionArgs = DataFunctionArgs;

/**
 * Route loader function signature
 */
export interface LoaderFunction {
	(args: LoaderFunctionArgs): Promise<Response> | Response | Promise<any> | any;
}

/**
 * Route action function signature
 */
export interface ActionFunction {
	(args: ActionFunctionArgs): Promise<Response> | Response | Promise<any> | any;
}

/**
 * Function provided by the framework-aware layers to set `hasErrorBoundary`
 * from the framework-aware `errorElement` prop
 */
export interface DetectErrorBoundaryFunction {
	(route: RouteObject): boolean;
}

/**
 * Keys we cannot change from within a lazy() function. We spread all other keys
 * onto the route. Either they're meaningful to the router, or they'll get
 * ignored.
 */
export type ImmutableRouteKey =
	| "lazy"
	| "caseSensitive"
	| "path"
	| "id"
	| "index"
	| "children";

export const immutableRouteKeys = new Set<ImmutableRouteKey>([
	"lazy",
	"caseSensitive",
	"path",
	"id",
	"index",
	"children",
]);

/**
 * lazy() function to load a route definition, which can add non-matching
 * related properties to a route
 */
export interface LazyRouteFunction<R extends RouteObject> {
	(): Promise<Omit<R, ImmutableRouteKey>>;
}

/**
 * Base RouteObject with common props shared by all types of routes
 */
type AgnosticBaseRouteObject = {
	caseSensitive?: boolean;
	path?: string;
	id?: string;
	loader?: LoaderFunction;
	action?: ActionFunction;
	hasErrorBoundary?: boolean;
	component?: any;
	lazy?: LazyRouteFunction<AgnosticBaseRouteObject>;
};

/**
 * Index routes must not have children
 */
export type IndexRouteObject = AgnosticBaseRouteObject & {
	children?: undefined;
	index: true;
};

/**
 * Non-index routes may have children, but cannot have index
 */
export type NonIndexRouteObject = AgnosticBaseRouteObject & {
	children?: RouteObject[];
	index?: false;
};

/**
 * A route object represents a logical route, with (optionally) its child
 * routes organized in a tree-like structure.
 */
export type RouteObject = IndexRouteObject | NonIndexRouteObject;

export type AgnosticDataIndexRouteObject = IndexRouteObject & {
	id: string;
};

export type AgnosticDataNonIndexRouteObject = NonIndexRouteObject & {
	children?: AgnosticDataRouteObject[];
	id: string;
};

/**
 * A data route object, which is just a RouteObject with a required unique ID
 */
export type AgnosticDataRouteObject =
	| AgnosticDataIndexRouteObject
	| AgnosticDataNonIndexRouteObject;

export type RouteManifest = Record<string, AgnosticDataRouteObject | undefined>;

// Recursive helper for finding path parameters in the absence of wildcards
type _PathParam<Path extends string> =
	// split path into individual path segments
	Path extends `${infer L}/${infer R}`
		? _PathParam<L> | _PathParam<R>
		: // find params after `:`
		Path extends `:${infer Param}`
		? Param extends `${infer Optional}?`
			? Optional
			: Param
		: // otherwise, there aren't any params present
		  never;

/**
 * Examples:
 * "/a/b/*" -> "*"
 * ":a" -> "a"
 * "/a/:b" -> "b"
 * "/a/blahblahblah:b" -> "b"
 * "/:a/:b" -> "a" | "b"
 * "/:a/b/:c/*" -> "a" | "c" | "*"
 */
type PathParam<Path extends string> =
	// check if path is just a wildcard
	Path extends "*" | "/*"
		? "*"
		: // look for wildcard at the end of the path
		Path extends `${infer Rest}/*`
		? "*" | _PathParam<Rest>
		: // look for params in the absence of wildcards
		  _PathParam<Path>;

// Attempt to parse the given string segment. If it fails, then just return the
// plain string type as a default fallback. Otherwise return the union of the
// parsed string literals that were referenced as dynamic segments in the route.
export type ParamParseKey<Segment extends string> =
	// if could not find path params, fallback to `string`
	[PathParam<Segment>] extends [never] ? string : PathParam<Segment>;

/**
 * The parameters that were parsed from the URL path.
 */
export type Params<Key extends string = string> = {
	readonly [key in Key]: string | undefined;
};

/**
 * A RouteMatch contains info about how a route matched a URL.
 */
export interface RouteMatch<
	ParamKey extends string = string,
	RouteObjectType extends RouteObject = RouteObject,
> {
	/**
	 * The names and values of dynamic parameters in the URL.
	 */
	params: Params<ParamKey>;
	/**
	 * The portion of the URL pathname that was matched.
	 */
	pathname: string;
	/**
	 * The portion of the URL pathname that was matched before child routes.
	 */
	pathnameBase: string;
	/**
	 * The route object that was used to match.
	 */
	route: RouteObjectType;
}

export type AgnosticDataRouteMatch = RouteMatch<
	string,
	AgnosticDataRouteObject
>;

function isIndexRoute(route: RouteObject): route is IndexRouteObject {
	return route.index === true;
}

// Walk the route tree generating unique IDs where necessary so we are working
// solely with AgnosticDataRouteObject's within the Router
export function convertRoutesToDataRoutes(
	routes: RouteObject[],
	detectErrorBoundary: DetectErrorBoundaryFunction,
	parentPath: number[] = [],
	manifest: RouteManifest = {},
): AgnosticDataRouteObject[] {
	return routes.map((route, index) => {
		const treePath = [...parentPath, index];
		const id = typeof route.id === "string" ? route.id : treePath.join("-");
		invariant(
			route.index !== true || !route.children,
			`Cannot specify children on an index route`,
		);
		invariant(
			!manifest[id],
			`Found a route id collision on id "${id}".  Route ` +
				"id's must be globally unique within Data Router usages",
		);

		if (isIndexRoute(route)) {
			const indexRoute: AgnosticDataIndexRouteObject = {
				...route,
				hasErrorBoundary: detectErrorBoundary(route),
				id,
			};
			manifest[id] = indexRoute;
			return indexRoute;
		} else {
			const pathOrLayoutRoute: AgnosticDataNonIndexRouteObject = {
				...route,
				id,
				hasErrorBoundary: detectErrorBoundary(route),
				children: undefined,
			};
			manifest[id] = pathOrLayoutRoute;

			if (route.children) {
				pathOrLayoutRoute.children = convertRoutesToDataRoutes(
					route.children,
					detectErrorBoundary,
					treePath,
					manifest,
				);
			}

			return pathOrLayoutRoute;
		}
	});
}

/**
 * Returns a path with params interpolated.
 *
 * @see https://reactrouter.com/utils/generate-path
 */
export function generatePath<Path extends string>(
	originalPath: Path,
	params: {
		[key in PathParam<Path>]: string | null;
	} = {} as any,
): string {
	let path: string = originalPath;
	if (path.endsWith("*") && path !== "*" && !path.endsWith("/*")) {
		warning(
			false,
			`Route path "${path}" will be treated as if it were ` +
				`"${path.replace(/\*$/, "/*")}" because the \`*\` character must ` +
				`always follow a \`/\` in the pattern. To get rid of this warning, ` +
				`please change the route path to "${path.replace(/\*$/, "/*")}".`,
		);
		path = path.replace(/\*$/, "/*") as Path;
	}

	// ensure `/` is added at the beginning if the path is absolute
	const prefix = path.startsWith("/") ? "/" : "";

	const segments = path
		.split(/\/+/)
		.map((segment, index, array) => {
			const isLastSegment = index === array.length - 1;

			// only apply the splat if it's the last segment
			if (isLastSegment && segment === "*") {
				const star = "*" as PathParam<Path>;
				const starParam = params[star];

				// Apply the splat
				return starParam;
			}

			const keyMatch = segment.match(/^:(\w+)(\??)$/);
			if (keyMatch) {
				const [, key, optional] = keyMatch;
				const param = params[key as PathParam<Path>];

				if (optional === "?") {
					return param == null ? "" : param;
				}

				if (param == null) {
					invariant(false, `Missing ":${key}" param`);
				}

				return param;
			}

			// Remove any optional markers from optional static segments
			return segment.replace(/\?$/g, "");
		})
		// Remove empty segments
		.filter((segment) => !!segment);

	return prefix + segments.join("/");
}

/**
 * A PathPattern is used to match on some portion of a URL pathname.
 */
export interface PathPattern<Path extends string = string> {
	/**
	 * A string to match against a URL pathname. May contain `:id`-style segments
	 * to indicate placeholders for dynamic parameters. May also end with `/*` to
	 * indicate matching the rest of the URL pathname.
	 */
	path: Path;
	/**
	 * Should be `true` if the static portions of the `path` should be matched in
	 * the same case.
	 */
	caseSensitive?: boolean;
	/**
	 * Should be `true` if this pattern should match the entire URL pathname.
	 */
	end?: boolean;
}

/**
 * A PathMatch contains info about how a PathPattern matched on a URL pathname.
 */
export interface PathMatch<ParamKey extends string = string> {
	/**
	 * The names and values of dynamic parameters in the URL.
	 */
	params: Params<ParamKey>;
	/**
	 * The portion of the URL pathname that was matched.
	 */
	pathname: string;
	/**
	 * The portion of the URL pathname that was matched before child routes.
	 */
	pathnameBase: string;
	/**
	 * The pattern that was used to match.
	 */
	pattern: PathPattern;
}

type Mutable<T> = {
	-readonly [P in keyof T]: T[P];
};

/**
 * Performs pattern matching on a URL pathname and returns information about
 * the match.
 *
 * @see https://reactrouter.com/utils/match-path
 */
export function matchPath<
	ParamKey extends ParamParseKey<Path>,
	Path extends string,
>(
	pattern: PathPattern<Path> | Path,
	pathname: string,
): PathMatch<ParamKey> | null {
	if (typeof pattern === "string") {
		pattern = { path: pattern, caseSensitive: false, end: true };
	}

	const [matcher, paramNames] = compilePath(
		pattern.path,
		pattern.caseSensitive,
		pattern.end,
	);

	const match = pathname.match(matcher);
	if (!match) return null;

	const matchedPathname = match[0];
	let pathnameBase = matchedPathname.replace(/(.)\/+$/, "$1");
	const captureGroups = match.slice(1);
	const params: Params = paramNames.reduce<Mutable<Params>>(
		(memo, paramName, index) => {
			// We need to compute the pathnameBase here using the raw splat value
			// instead of using params["*"] later because it will be decoded then
			if (paramName === "*") {
				const splatValue = captureGroups[index] || "";
				pathnameBase = matchedPathname
					.slice(0, matchedPathname.length - splatValue.length)
					.replace(/(.)\/+$/, "$1");
			}

			memo[paramName] = safelyDecodeURIComponent(
				captureGroups[index] || "",
				paramName,
			);
			return memo;
		},
		{},
	);

	return {
		params,
		pathname: matchedPathname,
		pathnameBase,
		pattern,
	};
}

function compilePath(
	path: string,
	caseSensitive = false,
	end = true,
): [RegExp, string[]] {
	warning(
		path === "*" || !path.endsWith("*") || path.endsWith("/*"),
		`Route path "${path}" will be treated as if it were ` +
			`"${path.replace(/\*$/, "/*")}" because the \`*\` character must ` +
			`always follow a \`/\` in the pattern. To get rid of this warning, ` +
			`please change the route path to "${path.replace(/\*$/, "/*")}".`,
	);

	const paramNames: string[] = [];
	let regexpSource =
		"^" +
		path
			.replace(/\/*\*?$/, "") // Ignore trailing / and /*, we'll handle it below
			.replace(/^\/*/, "/") // Make sure it has a leading /
			.replace(/[\\.*+^$?{}|()[\]]/g, "\\$&") // Escape special regex chars
			.replace(/\/:(\w+)/g, (_: string, paramName: string) => {
				paramNames.push(paramName);
				return "/([^\\/]+)";
			});

	if (path.endsWith("*")) {
		paramNames.push("*");
		regexpSource +=
			path === "*" || path === "/*"
				? "(.*)$" // Already matched the initial /, just match the rest
				: "(?:\\/(.+)|\\/*)$"; // Don't include the / in params["*"]
	} else if (end) {
		// When matching to the end, ignore trailing slashes
		regexpSource += "\\/*$";
	} else if (path !== "" && path !== "/") {
		// If our path is non-empty and contains anything beyond an initial slash,
		// then we have _some_ form of path in our regex so we should expect to
		// match only if we find the end of this path segment.  Look for an optional
		// non-captured trailing slash (to match a portion of the URL) or the end
		// of the path (if we've matched to the end).  We used to do this with a
		// word boundary but that gives false positives on routes like
		// /user-preferences since `-` counts as a word boundary.
		regexpSource += "(?:(?=\\/|$))";
	} else {
		// Nothing to match for "" or "/"
	}

	const matcher = new RegExp(regexpSource, caseSensitive ? undefined : "i");

	return [matcher, paramNames];
}

export function safelyDecodeURI(value: string) {
	try {
		return decodeURI(value);
	} catch (error) {
		warning(
			false,
			`The URL path "${value}" could not be decoded because it is is a ` +
				`malformed URL segment. This is probably due to a bad percent ` +
				`encoding (${error}).`,
		);

		return value;
	}
}

function safelyDecodeURIComponent(value: string, paramName: string) {
	try {
		return decodeURIComponent(value);
	} catch (error) {
		warning(
			false,
			`The value for the URL param "${paramName}" will not be decoded because` +
				` the string "${value}" is a malformed URL segment. This is probably` +
				` due to a bad percent encoding (${error}).`,
		);

		return value;
	}
}

/**
 * @private
 */
export function stripBasename(
	pathname: string,
	basename: string,
): string | null {
	if (basename === "/") return pathname;

	if (!pathname.toLowerCase().startsWith(basename.toLowerCase())) {
		return null;
	}

	// We want to leave trailing slash behavior in the user's control, so if they
	// specify a basename with a trailing slash, we should support it
	const startIndex = basename.endsWith("/")
		? basename.length - 1
		: basename.length;
	const nextChar = pathname.charAt(startIndex);
	if (nextChar && nextChar !== "/") {
		// pathname does not start with basename/
		return null;
	}

	return pathname.slice(startIndex) || "/";
}

/**
 * Returns a resolved path object relative to the given pathname.
 *
 * @see https://reactrouter.com/utils/resolve-path
 */
export function resolvePath(to: To, fromPathname = "/"): Path {
	const {
		pathname: toPathname,
		search = "",
		hash = "",
	} = typeof to === "string" ? parsePath(to) : to;

	const pathname = toPathname
		? toPathname.startsWith("/")
			? toPathname
			: resolvePathname(toPathname, fromPathname)
		: fromPathname;

	return {
		pathname,
		search: normalizeSearch(search),
		hash: normalizeHash(hash),
	};
}

function resolvePathname(relativePath: string, fromPathname: string): string {
	const segments = fromPathname.replace(/\/+$/, "").split("/");
	const relativeSegments = relativePath.split("/");

	relativeSegments.forEach((segment) => {
		if (segment === "..") {
			// Keep the root "" segment so the pathname starts at /
			if (segments.length > 1) segments.pop();
		} else if (segment !== ".") {
			segments.push(segment);
		}
	});

	return segments.length > 1 ? segments.join("/") : "/";
}

function getInvalidPathError(
	char: string,
	field: string,
	dest: string,
	path: Partial<Path>,
) {
	return (
		`Cannot include a '${char}' character in a manually specified ` +
		`\`to.${field}\` field [${JSON.stringify(
			path,
		)}].  Please separate it out to the ` +
		`\`to.${dest}\` field. Alternatively you may provide the full path as ` +
		`a string in <Link to="..."> and the router will parse it for you.`
	);
}

/**
 * @private
 *
 * When processing relative navigation we want to ignore ancestor routes that
 * do not contribute to the path, such that index/pathless layout routes don't
 * interfere.
 *
 * For example, when moving a route element into an index route and/or a
 * pathless layout route, relative link behavior contained within should stay
 * the same.  Both of the following examples should link back to the root:
 *
 *   <Route path="/">
 *     <Route path="accounts" element={<Link to=".."}>
 *   </Route>
 *
 *   <Route path="/">
 *     <Route path="accounts">
 *       <Route element={<AccountsLayout />}>       // <-- Does not contribute
 *         <Route index element={<Link to=".."} />  // <-- Does not contribute
 *       </Route
 *     </Route>
 *   </Route>
 */
export function getPathContributingMatches<T extends RouteMatch = RouteMatch>(
	matches: T[],
) {
	return matches.filter(
		(match, index) =>
			index === 0 || (match.route.path && match.route.path.length > 0),
	);
}

/**
 * @private
 */
export function resolveTo(
	toArg: To,
	routePathnames: string[],
	locationPathname: string,
	isPathRelative = false,
): Path {
	let to: Partial<Path>;
	if (typeof toArg === "string") {
		to = parsePath(toArg);
	} else {
		to = { ...toArg };

		invariant(
			!to.pathname || !to.pathname.includes("?"),
			getInvalidPathError("?", "pathname", "search", to),
		);
		invariant(
			!to.pathname || !to.pathname.includes("#"),
			getInvalidPathError("#", "pathname", "hash", to),
		);
		invariant(
			!to.search || !to.search.includes("#"),
			getInvalidPathError("#", "search", "hash", to),
		);
	}

	const isEmptyPath = toArg === "" || to.pathname === "";
	const toPathname = isEmptyPath ? "/" : to.pathname;

	let from: string;

	// Routing is relative to the current pathname if explicitly requested.
	//
	// If a pathname is explicitly provided in `to`, it should be relative to the
	// route context. This is explained in `Note on `<Link to>` values` in our
	// migration guide from v5 as a means of disambiguation between `to` values
	// that begin with `/` and those that do not. However, this is problematic for
	// `to` values that do not provide a pathname. `to` can simply be a search or
	// hash string, in which case we should assume that the navigation is relative
	// to the current location's pathname and *not* the route pathname.
	if (isPathRelative || toPathname == null) {
		from = locationPathname;
	} else {
		let routePathnameIndex = routePathnames.length - 1;

		if (toPathname.startsWith("..")) {
			const toSegments = toPathname.split("/");

			// Each leading .. segment means "go up one route" instead of "go up one
			// URL segment".  This is a key difference from how <a href> works and a
			// major reason we call this a "to" value instead of a "href".
			while (toSegments[0] === "..") {
				toSegments.shift();
				routePathnameIndex -= 1;
			}

			to.pathname = toSegments.join("/");
		}

		// If there are more ".." segments than parent routes, resolve relative to
		// the root / URL.
		from = routePathnameIndex >= 0 ? routePathnames[routePathnameIndex] : "/";
	}

	const path = resolvePath(to, from);

	// Ensure the pathname has a trailing slash if the original "to" had one
	const hasExplicitTrailingSlash =
		toPathname && toPathname !== "/" && toPathname.endsWith("/");
	// Or if this was a link to the current path which has a trailing slash
	const hasCurrentTrailingSlash =
		(isEmptyPath || toPathname === ".") && locationPathname.endsWith("/");
	if (
		!path.pathname.endsWith("/") &&
		(hasExplicitTrailingSlash || hasCurrentTrailingSlash)
	) {
		path.pathname += "/";
	}

	return path;
}

/**
 * @private
 */
export function getToPathname(to: To): string | undefined {
	// Empty strings should be treated the same as / paths
	return to === "" || (to as Path).pathname === ""
		? "/"
		: typeof to === "string"
		? parsePath(to).pathname
		: to.pathname;
}

/**
 * @private
 */
export const joinPaths = (paths: string[]): string =>
	paths.join("/").replace(/\/\/+/g, "/");

/**
 * @private
 */
export const normalizePathname = (pathname: string): string =>
	pathname.replace(/\/+$/, "").replace(/^\/*/, "/");

/**
 * @private
 */
export const normalizeSearch = (search: string): string =>
	!search || search === "?"
		? ""
		: search.startsWith("?")
		? search
		: "?" + search;

/**
 * @private
 */
export const normalizeHash = (hash: string): string =>
	!hash || hash === "#" ? "" : hash.startsWith("#") ? hash : "#" + hash;

export type JsonFunction = <Data>(
	data: Data,
	init?: number | ResponseInit,
) => Response;
