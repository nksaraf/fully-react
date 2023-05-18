"use client";
import * as React from "react";
import {
	CacheContext,
	DataCache,
	RehydrationContextProvider,
} from "./rehydration-context";

export const DataCacheSingleton = Symbol.for("dataCacheSingleton");
const SuspenseCacheSingleton = Symbol.for("ApolloSuspenseCacheSingleton");

declare global {
	interface Window {
		[DataCacheSingleton]?: DataCache;
		// [SuspenseCacheSingleton]?: SuspenseCache;
	}
}

export function globalCache() {
	return window[DataCacheSingleton];
}
export const DataProvider = ({
	cache,
	children,
}: React.PropsWithChildren<{
	cache: DataCache;
}>) => {
	return (
		<CacheContext.Provider value={cache}>
			<RehydrationContextProvider>{children}</RehydrationContextProvider>
		</CacheContext.Provider>
	);
};
