import { createBrowserHistory, createPath } from "history";
import React, {
	startTransition,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

import { useRerender } from "../client/hooks";
import { addMutationListener, mutate } from "../client/mutation";
import { refresh } from "../client/refresh";
import { routerContext } from "../client/router/context";
import { RouterAPI } from "../client/router/router-api";
import { createElementFromServer } from "../client/stream";
import { ServerComponent, serverElementCache } from "./server-component";

export function useBaseRouter() {
	const [url, setURL] = useState(() => createPath(new URL(location.href)));
	const enabledRef = useRef(true);
	const render = useRerender();
	const router = useMemo(() => {
		const history = createBrowserHistory();
		return {
			push: (url: string) => {
				history.push(url);
				startTransition(() => {
					setURL(url);
				});
			},
			replace: (url: string) => {
				history.replace(url);
				startTransition(() => {
					setURL(url);
				});
			},
			mutate: mutate,
			refresh: refresh,
			history,
			cache: serverElementCache,
			disable() {
				enabledRef.current = false;
			},
			enable() {
				enabledRef.current = true;
			},
			preload(url: string): React.Thenable<React.ReactElement> | Promise<any> {
				if (!serverElementCache.has(url)) {
					const promise = createElementFromServer(url);
					serverElementCache.set(url, promise);
					return promise;
				}
				return Promise.resolve();
			},
		} satisfies Omit<RouterAPI, "url">;
	}, [setURL]);

	useEffect(() => {
		return router.history.listen((update) => {
			if (enabledRef.current) {
				if (update.action === "POP") {
					startTransition(() => {
						setURL(createPath(update.location));
					});
				}
			}
		});
	}, [router]);

	useEffect(() => {
		// this should only be triggered if no other mutation listeners have been added below it
		return addMutationListener((val) => {
			console.log("mutation", enabledRef.current);
			if (enabledRef.current) {
				startTransition(() => {
					serverElementCache.set(url, val);
					render();
				});
			}
		});
	}, [url, router]);

	return { ...router, url } as const;
}

function BaseRouter({ children }: { children: React.ReactNode }) {
	const router = useBaseRouter();

	return (
		<routerContext.Provider value={router}>{children}</routerContext.Provider>
	);
}

function CurrentServerComponent() {
	const router = useBaseRouter();
	return <ServerComponent url={router.url} />;
}

export function Router() {
	return (
		<BaseRouter>
			<CurrentServerComponent />
		</BaseRouter>
	);
}

export function AppRouter() {
	return <ServerComponent url={window.location.href} />;
}
