import React, { createContext, useContext, useRef } from "react";
import { ServerInsertedHTMLContext } from "../server/server-inserted-html";
import { RehydrationContextValue } from "../server/types";
import { registerDataTransport, transportDataToJS } from "./dataTransport";
import { registerLateInitializingQueue } from "./lazyQueue";
import { ResultCacheSymbol } from "./rehydrateSymbols";

export class DataCache {
	private rehydrationContext: Pick<
		RehydrationContextValue,
		"incomingResults"
	> & { uninitialized?: boolean } = {
		incomingResults: [],
		uninitialized: true,
	};
	constructor(config?: any) {
		// super(config);

		this.registerWindowHook();
	}
	private registerWindowHook() {
		if (typeof window !== "undefined") {
			if (Array.isArray(window[ResultCacheSymbol] || [])) {
				registerLateInitializingQueue(ResultCacheSymbol, (data) =>
					this.write(data),
				);
			} else {
				throw new Error(
					"On the client side, only one instance of `NextSSRInMemoryCache` can be created!",
				);
			}
		}
	}

	write(options: any): any | undefined {
		if (typeof window == "undefined") {
			this.rehydrationContext.incomingResults.push(options);
		}
		console.log("write", options);
		// return super.write(options);
	}

	setRehydrationContext(rehydrationContext: RehydrationContextValue) {
		if (this.rehydrationContext.uninitialized) {
			rehydrationContext.incomingResults.push(
				...this.rehydrationContext.incomingResults,
			);
		}
		this.rehydrationContext = rehydrationContext;
		this.rehydrationContext.uninitialized = false;
	}
}

const RehydrationContext = createContext<RehydrationContextValue | undefined>(
	undefined,
);

export const CacheContext = createContext<DataCache | null>(null);

function useCache() {
	const cache = useContext(CacheContext);
	if (!cache) {
		throw new Error(
			"Could not find `CacheContext`. Did you forget to wrap the app in a `RehydrationContextProvider`?",
		);
	}
	return cache;
}

export const RehydrationContextProvider = ({
	children,
}: React.PropsWithChildren) => {
	const cache = useCache();
	const rehydrationContext = useRef<RehydrationContextValue>();
	if (typeof window == "undefined") {
		if (!rehydrationContext.current) {
			rehydrationContext.current = buildRehydrationContext();
		}

		if (cache) {
			cache.setRehydrationContext(rehydrationContext.current);
		} else {
			throw new Error(
				"When using Next SSR, you must use the `NextSSRInMemoryCache`",
			);
		}
	} else {
		registerDataTransport();
	}
	return (
		<RehydrationContext.Provider value={rehydrationContext.current}>
			{children}
		</RehydrationContext.Provider>
	);
};

export function useRehydrationContext(): RehydrationContextValue | undefined {
	const rehydrationContext = useContext(RehydrationContext);
	const insertHtml = useContext(ServerInsertedHTMLContext);

	// help transpilers to omit this code in bundling
	if (typeof window !== "undefined") return;

	if (
		insertHtml &&
		rehydrationContext &&
		!rehydrationContext.currentlyInjected
	) {
		rehydrationContext.currentlyInjected = true;
		insertHtml(() => <rehydrationContext.RehydrateOnClient />);
	}
	return rehydrationContext;
}

function buildRehydrationContext(): RehydrationContextValue {
	const rehydrationContext: RehydrationContextValue = {
		currentlyInjected: false,
		transportValueData: {},
		transportedValues: {},
		incomingResults: [],
		RehydrateOnClient() {
			rehydrationContext.currentlyInjected = false;
			if (
				!Object.keys(rehydrationContext.transportValueData).length &&
				!Object.keys(rehydrationContext.incomingResults).length
			)
				return <></>;

			const __html = transportDataToJS({
				rehydrate: Object.fromEntries(
					Object.entries(rehydrationContext.transportValueData).filter(
						([key, value]) =>
							rehydrationContext.transportedValues[key] !== value,
					),
				),
				results: rehydrationContext.incomingResults,
			});
			Object.assign(
				rehydrationContext.transportedValues,
				rehydrationContext.transportValueData,
			);
			rehydrationContext.transportValueData = {};
			rehydrationContext.incomingResults = [];
			return (
				<script
					dangerouslySetInnerHTML={{
						__html,
					}}
				/>
			);
		},
	};
	return rehydrationContext;
}
