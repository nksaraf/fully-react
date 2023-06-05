"use client";

import * as React from "react";

import {
	CacheContext,
	DataCache,
	RehydrationContextProvider,
} from "./rehydration-context";

export const DataCacheSingleton = Symbol.for("dataCacheSingleton");

declare global {
	interface Window {
		[DataCacheSingleton]?: DataCache;
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
