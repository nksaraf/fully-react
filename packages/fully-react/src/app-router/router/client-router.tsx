"use client";

import {
	PropsWithChildren,
	ReactNode,
	useEffect,
	useMemo,
	useState,
	useTransition,
	// @ts-ignore  TODO: enable react@next types
	use,
	createContext,
	useContext,
	useReducer,
} from "react";
// import { FLIGHT_REQUEST_HEADER, ROUTER_STATE_HEADER } from "../shared";
import { createFromFetch } from "react-server-dom-webpack/client.browser";
import { ParsedPath, parsePath, takeSegment } from "./paths";
import { GlobalRouterContext } from "./navigation-context";

export const getPathFromDOMState = () => {
	// TODO: searchparams etc?
	return document.location.pathname;
};

export const ClientRouter = ({
	cache,
	initialPath,
	children,
}: PropsWithChildren<{
	cache: LayoutCacheNode;
	initialPath: string;
}>) => {
	const [pathKey, setPathKey] = useState<string>(initialPath);
	const state = useMemo(() => parsePath(pathKey), [pathKey]);
	console.log("=".repeat(40));
	console.log("ClientRouter", state);
	const [isNavigating, startTransition] = useTransition();
	const [, forceRerender] = useReducer((count) => count + 1, 0);

	useEffect(() => {
		const listener = (_event: PopStateEvent) => {
			const restoredPath = getPathFromDOMState();
			console.log("popstate", restoredPath);
			setPathKey(restoredPath);
		};
		window.addEventListener("popstate", listener);
		return () => window.removeEventListener("popstate", listener);
	}, []);

	const navigation = useMemo<NavigationContextValue>(
		() => ({
			key: pathKey,
			isNavigating,
			navigate(
				newPath,
				{
					type = "push",
					// noCache = false,
					instant = false,
				}: NavigateOptions = {},
			) {
				const doNavigate = () => {
					// let newKey = newPath;
					// if (noCache) {
					//   newKey += ":" + Date.now();
					// }

					setPathKey(newPath);

					// TODO: do we wanna use the state for something?
					// like the current key, if we do something like the date-key above?
					if (type === "push") {
						window.history.pushState(null, "", newPath);
					} else {
						window.history.replaceState(null, "", newPath);
					}

					const newState = parsePath(newPath);
					const pathExistsInCache = hasCachePath(cache, newState);
					if (pathExistsInCache) {
						return;
					}

					console.log("cache before create", debugCache(cache));

					const [cacheNode, existingSegments] =
						createShallowestCacheNodeForPath(cache, newState);
					console.log("created node", { existingSegments });
					console.log("cache after create", debugCache(cache));

					const cacheInstallPath = [
						...existingSegments,
						newState[existingSegments.length],
					];

					// if (didExist) {
					//   // until we support refetches, we should never stomp over an existing node
					//   throw new Error(
					//     "Internal error -- node already existed in the cache: " +
					//       JSON.stringify(cacheInstallPath)
					//   );
					// }

					console.log("requesting RSC from server", {
						state,
						newPath,
						cacheInstallPath,
						cacheNode,
					});
					const request = fetch(newPath, {
						headers: {
							[FLIGHT_REQUEST_HEADER]: "1",
							// hack -- trick the current server-side machinery into skipping existing segments
							// (it'll keep going until it finds one that doesn't match...)
							[ROUTER_STATE_HEADER]: JSON.stringify(existingSegments),
						},
					});
					const fetchedRSC = createFromFetch(request, {});

					// TODO: idk about this one, would be nicer to just store a promise
					// (i.e. allow the cache to store in-flight data in a more sensible manner)
					const RSCResponseWrapper = () => {
						return use(fetchedRSC);
					};

					// DEBUG
					RSCResponseWrapper[
						"displayName"
					] = `RSCResponseWrapper:${JSON.stringify(cacheInstallPath)}`;

					cacheNode.subTree = <RSCResponseWrapper />;
				};

				if (instant) {
					doNavigate();
				} else {
					startTransition(doNavigate);
				}
			},
		}),
		[pathKey, state, isNavigating, cache],
	);

	const ctx: GlobalRouterContextValue = useMemo(
		() => ({
			navigation,
			state,
		}),
		[state, navigation],
	);

	return (
		<GlobalRouterContext.Provider value={ctx}>
			<SegmentContext.Provider
				value={{
					cacheNode: cache,
					remainingPath: state,
				}}
			>
				{children}
			</SegmentContext.Provider>
		</GlobalRouterContext.Provider>
	);
};

// new cache

export const createLayoutCacheRoot = (): LayoutCacheNode => {
	return {
		segment: "<root>",
		subTree: null,
		children: new Map(),
	};
};

const getOrCreateCacheNode = (
	cacheNode: LayoutCacheNode,
	key: string,
): [cacheNode: LayoutCacheNode, didExist: boolean] => {
	const existingNode = cacheNode.children.get(key);
	if (existingNode) {
		return [existingNode, true];
	} else {
		const newNode = createLayoutCacheNode(key, null);
		cacheNode.children.set(key, newNode);
		return [newNode, false];
	}
};

const getChildNode = (cacheNode: LayoutCacheNode, key: string) => {
	return cacheNode.children.get(key);
};

const addChildNode = (
	cacheNode: LayoutCacheNode,
	key: string,
	child: LayoutCacheNode,
) => {
	if (cacheNode.children.has(key)) {
		console.warn(
			"overriting existing child, this should't really happen...",
			cacheNode,
			key,
			child,
		);
	}
	return cacheNode.children.set(key, child);
};

const createShallowestCacheNodeForPath = (
	cacheNode: LayoutCacheNode,
	path: ParsedPath,
): [cacheNode: LayoutCacheNode, existingPath: ParsedPath] => {
	console.log("createCacheNodeForPath", path);
	if (path.length === 0) {
		// TODO: this case is weird. i'm not sure if this should ever happen.
		return [cacheNode, []];
	}
	const [segment, rest] = takeSegment(path);
	let childNode = getChildNode(cacheNode, segment);
	if (!childNode) {
		childNode = createLayoutCacheNode(segment, null);
		addChildNode(cacheNode, segment, childNode);
		return [childNode, []];
	} else {
		const [finalNode, existingPath] = createShallowestCacheNodeForPath(
			childNode,
			rest,
		);
		existingPath.unshift(segment); // safe to mutate, because no one else has access to it yet.
		return [finalNode, existingPath];
	}
};

const hasCachePath = (
	cacheNode: LayoutCacheNode,
	path: ParsedPath,
): boolean => {
	if (path.length === 0) throw new Error("oops, this shouldn't happen");
	const nodeForFirstSegment = cacheNode.children.get(path[0]);
	if (path.length === 1 || !nodeForFirstSegment) {
		return !!nodeForFirstSegment;
	}
	return hasCachePath(nodeForFirstSegment, path.slice(1));
};

export const createLayoutCacheNode = (
	segment: string,
	subTree: ReactNode,
): LayoutCacheNode => ({
	segment,
	subTree,
	children: new Map(),
});

type LayoutCacheNode = {
	segment: string;
	subTree: ReactNode;
	children: Map<string, LayoutCacheNode>;
};

type SegmentContextValue = {
	remainingPath: ParsedPath;
	cacheNode: LayoutCacheNode;
};

export const SegmentContext = createContext<SegmentContextValue | null>(null);

const useSegmentContext = () => {
	useContext(GlobalRouterContext); // make sure we're subscribed to path changes.
	const ctx = useContext(SegmentContext);
	if (!ctx) {
		throw new Error("Missing LayoutCacheContext.Provider");
	}
	return ctx;
};

const debugCache = (cacheNode: LayoutCacheNode) => {
	const walk = (node: LayoutCacheNode): Record<string, any> | string => {
		if (!node.children.size) {
			return node.subTree === null ? "<empty>" : "content ...";
		}
		return Object.fromEntries(
			[...node.children.entries()].map(([k, v]) => [`${k}`, walk(v)]),
		);
	};

	const res = walk(cacheNode);
	return JSON.stringify(res, null, 4);
};

export const RouterSegment = ({
	children,
	isRootLayout, // TODO: unused right now!,
	DEBUG_originalSegmentPath,
}: PropsWithChildren<{
	isRootLayout: boolean;
	DEBUG_originalSegmentPath: string;
}>) => {
	const { cacheNode: parentCacheNode, remainingPath } = useSegmentContext();

	const [segmentPath, pathBelowSegment] = useMemo(
		() => takeSegment(remainingPath),
		[remainingPath],
	);
	console.log(
		"RouterSegmentLayout",
		segmentPath,
		`(originally "${DEBUG_originalSegmentPath}")`,
		pathBelowSegment,
		debugCache(parentCacheNode),
	);

	if (!parentCacheNode.children.has(segmentPath)) {
		console.log("storing subtree for segment", segmentPath);
		parentCacheNode.children.set(
			segmentPath,
			createLayoutCacheNode(segmentPath, children),
		);
		console.log("after:", debugCache(parentCacheNode));
	} else {
		console.log("already got cached subtree for segment", segmentPath);
	}

	const ownCacheNode = parentCacheNode.children.get(segmentPath)!;
	const ctxForSegmentsBelow: SegmentContextValue = useMemo(
		() => ({ cacheNode: ownCacheNode, remainingPath: pathBelowSegment }),
		[ownCacheNode, pathBelowSegment],
	);

	const cachedChildren = ownCacheNode.subTree;

	return (
		<SegmentContext.Provider value={ctxForSegmentsBelow}>
			{cachedChildren}
		</SegmentContext.Provider>
	);
};
