"use client";

import { createBrowserHistory, createMemoryHistory, createPath } from "history";
import React, {
	startTransition,
	use,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useReducer,
	useRef,
	useState,
} from "react";

import { NotFoundBoundary } from "./not-found-boundary";
import { RedirectBoundary } from "./redirect-boundary";
import { addMutationListener } from "../../../client/mutation";
import { refresh } from "../../../client/refresh";
import { routerContext } from "../../../client/router";

import { RouteMatch, RouteObject } from "../../client/router/utils";
import { matchRoutes } from "../../client/router/matchRoutes";

import { Assets } from "../../../shared/assets";
import { PageProps } from "../../types";
import { createLocation } from "../../../fs-router/path";

export function renderMatches(
	matches: RouteMatch[],
	props: PageProps,
): React.ReactElement | null {
	const renderedMatches = matches;

	return renderedMatches.reduceRight((outlet, match) => {
		const getChildren = () => {
			if (match.route.component) {
				return (
					<LayoutRouter
						segment={match.pathname}
						child={<match.route.component children={outlet} {...props} />}
					/>
				);
			}

			return <div>404</div>;
		};
		return getChildren();
	}, null as React.ReactElement | null);
}

function DefaultErrorComponent() {
	return (
		<html lang="en">
			<head>
				<title>RSC Playground</title>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<link rel="icon" type="image/x-icon" href="/favicon.ico" />
				<Assets />
			</head>
			<body>
				<div>404</div>
			</body>
		</html>
	);
}

const createLayoutCacheRoot = () => {
	return {
		segment: "<root>",
		subTree: null,
		children: new Map(),
	};
};

function clientReducer(state: RouterState, action: RouterAction) {
	switch (action.type) {
		case "navigate":
			// if (!state.cache.has(action.url)) {
			// 	state.cache.set(action.url, createElementFromServer(action.url));
			// }
			return { ...state, url: action.url };
		default:
			return state;
	}
}

function serverReducer(state: RouterState, action: RouterAction) {
	return state;
}

const reducer = typeof window === "undefined" ? serverReducer : clientReducer;

export function createRouter(
	routes: RouteObject[],
	{
		errorComponent = DefaultErrorComponent,
		notFoundComponent = DefaultErrorComponent,
	} = {},
) {
	function AppRouter(props: PageProps) {
		const enabledRef = useRef(true);
		const initialState = useMemo(() => {
			return {
				url: props.url,
			};
		}, [props.url]);

		const [state, dispatch] = useReducer(reducer, initialState);

		const basename = "/";
		const url = new URL(state.url, "http://localhost:3000");
		const location = createLocation("", createPath(url), null, "default");
		const matches = matchRoutes(routes, location, basename);

		const NotFound = routes[0]?.component ?? notFoundComponent;
		const notFound = (
			<NotFound {...props} params={{}} children={<div>404</div>} />
		);

		let content: React.ReactNode = notFound;

		if (matches) {
			const params = matches.reduce((params, match) => {
				return { ...params, ...match.params };
			}, {});

			content = renderMatches(matches, {
				...props,
				searchParams: Object.fromEntries(url.searchParams.entries()),
				params,
			});
		}

		const renrender = useRerender();

		const router = useMemo(() => {
			const history =
				typeof window === "undefined"
					? createMemoryHistory()
					: createBrowserHistory();

			return {
				push(url: string, state: any) {
					history.push(url, state);
					startTransition(() => dispatch({ type: "navigate", url }));
				},
				replace(url: string, state: any) {
					history.replace(url, state);
					startTransition(() => dispatch({ type: "navigate", url }));
				},
				preload(
					url: string,
				): React.Thenable<React.ReactElement> | Promise<any> {
					return Promise.resolve();
				},
				mutate: globalThis.mutate,
				refresh: refresh,
				history,
				// cache,
				disable() {
					enabledRef.current = false;
				},
				enable() {
					enabledRef.current = true;
				},
			};
		}, [dispatch]);

		useEffect(() => {
			return router.history.listen((update) => {
				if (enabledRef.current && update.action === "POP") {
					startTransition(() => {
						dispatch({ type: "navigate", url: createPath(update.location) });
					});
				}
			});
		}, [router]);

		useLayoutEffect(() => {
			// if (existingRouter) {
			// 	existingRouter.disable();
			// }
			// return () => {
			// 	if (existingRouter) {
			// 		existingRouter.enable();
			// 	}
			// };
		});

		useEffect(() => {
			return addMutationListener((val) => {
				if (enabledRef.current) {
					// state.cache.set(state.url, val);
					startTransition(() => {
						renrender();
					});
				}
			});
		}, [state, router, renrender]);

		return (
			<routerContext.Provider value={{ url: state.url, ...router }}>
				<RedirectBoundary>
					{/* <NotFoundBoundary notFound={notFound}> */}
					<LayoutRouter child={content} />
					{/* </NotFoundBoundary> */}
				</RedirectBoundary>
			</routerContext.Provider>
		);
	}

	return AppRouter;
}

export function useRerender() {
	const [_, rerender] = useState(() => 0);
	return useCallback(() => {
		rerender((n) => n + 1);
	}, [rerender]);
}

type RouterState = {
	url: string;
	// cache: Map<string, React.Thenable<React.ReactElement>>;
};

type RouterAction = { type: "navigate"; url: string };

const layoutContext = React.createContext<{}>({});

export function LayoutRouter({
	child,
	segment,
}: {
	child: any;
	segment?: string;
}) {
	return (
		<layoutContext.Provider key={segment} value={{}}>
			<RedirectBoundary>
				<NotFoundBoundary notFound={<div>404</div>}>
					<InnerLayoutRouter child={child} />
				</NotFoundBoundary>
			</RedirectBoundary>
		</layoutContext.Provider>
	);
}

function InnerLayoutRouter({ child }: { child: any }) {
	const resolvedContext = child?.then ? use(child) : child ?? (null as any);
	return resolvedContext;
}
