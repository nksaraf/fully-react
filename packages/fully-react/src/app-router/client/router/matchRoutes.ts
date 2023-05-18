import warning from "tiny-warning";
import invariant from "tiny-invariant";
import type { Location } from "../../../fs-router/path";
import { parsePath } from "../../../fs-router/path";
import { RouteObject, RouteMatch, Params } from "./utils";

/**
 * Matches the given routes to a location and returns the match data.
 *
 * @see https://reactrouter.com/utils/match-routes
 */

export function matchRoutes<RouteObjectType extends RouteObject = RouteObject>(
	routes: RouteObjectType[],
	locationArg: Partial<Location> | string,
	basename = "/",
): RouteMatch<string, RouteObjectType>[] | null {
	const location =
		typeof locationArg === "string" ? parsePath(locationArg) : locationArg;

	const pathname = stripBasename(location.pathname || "/", basename);

	if (pathname == null) {
		return null;
	}

	const branches = flattenRoutes(routes);
	rankRouteBranches(branches);

	let matches = null;
	for (let i = 0; matches == null && i < branches.length; ++i) {
		matches = matchRouteBranch<string, RouteObjectType>(
			branches[i],
			// Incoming pathnames are generally encoded from either window.location
			// or from router.navigate, but we want to match against the unencoded
			// paths in the route definitions.  Memory router locations won't be
			// encoded here but there also shouldn't be anything to decode so this
			// should be a safe operation.  This avoids needing matchRoutes to be
			// history-aware.
			safelyDecodeURI(pathname),
		);
	}

	return matches;
}
interface RouteMeta<RouteObjectType extends RouteObject = RouteObject> {
	relativePath: string;
	caseSensitive: boolean;
	childrenIndex: number;
	route: RouteObjectType;
}
interface RouteBranch<RouteObjectType extends RouteObject = RouteObject> {
	path: string;
	score: number;
	routesMeta: RouteMeta<RouteObjectType>[];
}
function flattenRoutes<RouteObjectType extends RouteObject = RouteObject>(
	routes: RouteObjectType[],
	branches: RouteBranch<RouteObjectType>[] = [],
	parentsMeta: RouteMeta<RouteObjectType>[] = [],
	parentPath = "",
): RouteBranch<RouteObjectType>[] {
	const flattenRoute = (
		route: RouteObjectType,
		index: number,
		relativePath?: string,
	) => {
		const meta: RouteMeta<RouteObjectType> = {
			relativePath:
				relativePath === undefined ? route.path || "" : relativePath,
			caseSensitive: route.caseSensitive === true,
			childrenIndex: index,
			route,
		};

		if (meta.relativePath.startsWith("/")) {
			invariant(
				meta.relativePath.startsWith(parentPath),
				`Absolute route path "${meta.relativePath}" nested under path ` +
					`"${parentPath}" is not valid. An absolute child route path ` +
					`must start with the combined path of all its parent routes.`,
			);

			meta.relativePath = meta.relativePath.slice(parentPath.length);
		}

		const path = joinPaths([parentPath, meta.relativePath]);
		const routesMeta = parentsMeta.concat(meta);

		// Add the children before adding this route to the array so we traverse the
		// route tree depth-first and child routes appear before their parents in
		// the "flattened" version.
		if (route.children && route.children.length > 0) {
			invariant(
				// Our types know better, but runtime JS may not!
				// @ts-expect-error
				route.index !== true,
				`Index routes must not have child routes. Please remove ` +
					`all child routes from route path "${path}".`,
			);

			flattenRoutes(route.children, branches, routesMeta, path);
		}

		// Routes without a path shouldn't ever match by themselves unless they are
		// index routes, so don't add them to the list of possible branches.
		if (route.path == null && !route.index) {
			return;
		}

		branches.push({
			path,
			score: computeScore(path, route.index),
			routesMeta,
		});
	};
	routes.forEach((route, index) => {
		// coarse-grain check for optional params
		if (route.path === "" || !route.path?.includes("?")) {
			flattenRoute(route, index);
		} else {
			for (const exploded of explodeOptionalSegments(route.path)) {
				flattenRoute(route, index, exploded);
			}
		}
	});

	return branches;
}
/**
 * Computes all combinations of optional path segments for a given path,
 * excluding combinations that are ambiguous and of lower priority.
 *
 * For example, `/one/:two?/three/:four?/:five?` explodes to:
 * - `/one/three`
 * - `/one/:two/three`
 * - `/one/three/:four`
 * - `/one/three/:five`
 * - `/one/:two/three/:four`
 * - `/one/:two/three/:five`
 * - `/one/three/:four/:five`
 * - `/one/:two/three/:four/:five`
 */
function explodeOptionalSegments(path: string): string[] {
	const segments = path.split("/");
	if (segments.length === 0) return [];

	const [first, ...rest] = segments;

	// Optional path segments are denoted by a trailing `?`
	const isOptional = first.endsWith("?");
	// Compute the corresponding required segment: `foo?` -> `foo`
	const required = first.replace(/\?$/, "");

	if (rest.length === 0) {
		// Intepret empty string as omitting an optional segment
		// `["one", "", "three"]` corresponds to omitting `:two` from `/one/:two?/three` -> `/one/three`
		return isOptional ? [required, ""] : [required];
	}

	const restExploded = explodeOptionalSegments(rest.join("/"));

	const result: string[] = [];

	// All child paths with the prefix.  Do this for all children before the
	// optional version for all children so we get consistent ordering where the
	// parent optional aspect is preferred as required.  Otherwise, we can get
	// child sections interspersed where deeper optional segments are higher than
	// parent optional segments, where for example, /:two would explodes _earlier_
	// then /:one.  By always including the parent as required _for all children_
	// first, we avoid this issue
	result.push(
		...restExploded.map((subpath) =>
			subpath === "" ? required : [required, subpath].join("/"),
		),
	);

	// Then if this is an optional value, add all child versions without
	if (isOptional) {
		result.push(...restExploded);
	}

	// for absolute paths, ensure `/` instead of empty segment
	return result.map((exploded) =>
		path.startsWith("/") && exploded === "" ? "/" : exploded,
	);
}
function rankRouteBranches(branches: RouteBranch[]): void {
	branches.sort((a, b) =>
		a.score !== b.score
			? b.score - a.score // Higher score first
			: compareIndexes(
					a.routesMeta.map((meta) => meta.childrenIndex),
					b.routesMeta.map((meta) => meta.childrenIndex),
			  ),
	);
}
const paramRe = /^:\w+$/;
const dynamicSegmentValue = 3;
const indexRouteValue = 2;
const emptySegmentValue = 1;
const staticSegmentValue = 10;
const splatPenalty = -2;
const isSplat = (s: string) => s === "*";
function computeScore(path: string, index: boolean | undefined): number {
	const segments = path.split("/");
	let initialScore = segments.length;
	if (segments.some(isSplat)) {
		initialScore += splatPenalty;
	}

	if (index) {
		initialScore += indexRouteValue;
	}

	return segments
		.filter((s) => !isSplat(s))
		.reduce(
			(score, segment) =>
				score +
				(paramRe.test(segment)
					? dynamicSegmentValue
					: segment === ""
					? emptySegmentValue
					: staticSegmentValue),
			initialScore,
		);
}
function compareIndexes(a: number[], b: number[]): number {
	const siblings =
		a.length === b.length && a.slice(0, -1).every((n, i) => n === b[i]);

	return siblings
		? // If two routes are siblings, we should try to match the earlier sibling

		  // first. This allows people to have fine-grained control over the matching
		  // behavior by simply putting routes with identical paths in the order they
		  // want them tried.
		  a[a.length - 1] - b[b.length - 1]
		: // Otherwise, it doesn't really make sense to rank non-siblings by index,

		  // so they sort equally.
		  0;
}
function matchRouteBranch<
	ParamKey extends string = string,
	RouteObjectType extends RouteObject = RouteObject,
>(
	branch: RouteBranch<RouteObjectType>,
	pathname: string,
): RouteMatch<ParamKey, RouteObjectType>[] | null {
	const { routesMeta } = branch;

	const matchedParams = {};
	let matchedPathname = "/";
	const matches: RouteMatch<ParamKey, RouteObjectType>[] = [];
	for (let i = 0; i < routesMeta.length; ++i) {
		const meta = routesMeta[i];
		const end = i === routesMeta.length - 1;
		const remainingPathname =
			matchedPathname === "/"
				? pathname
				: pathname.slice(matchedPathname.length) || "/";
		const match = matchPath(
			{ path: meta.relativePath, caseSensitive: meta.caseSensitive, end },
			remainingPathname,
		);

		if (!match) return null;

		Object.assign(matchedParams, match.params);

		const route = meta.route;

		matches.push({
			// TODO: Can this as be avoided?
			params: matchedParams as Params<ParamKey>,
			pathname: joinPaths([matchedPathname, match.pathname]),
			pathnameBase: normalizePathname(
				joinPaths([matchedPathname, match.pathnameBase]),
			),
			route,
		});

		if (match.pathnameBase !== "/") {
			matchedPathname = joinPaths([matchedPathname, match.pathnameBase]);
		}
	}

	return matches;
}

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
