import { deserialize, stringify } from "superjson";

import { registerLateInitializingQueue } from "./lazyQueue";
import {
	RehydrationCacheSymbol,
	ResultCacheSymbol,
	SSRDataTransport,
} from "./rehydrateSymbols";
import { RehydrationCache } from "./types";

export type DataTransport<T> = Array<T> | { push(...args: T[]): void };

type DataToTransport = {
	rehydrate: RehydrationCache;
	results: any[];
};

/**
 * Returns a string of JavaScript that can be used to transport data to the client.
 */
export function transportDataToJS(data: DataToTransport) {
	const key = Symbol.keyFor(SSRDataTransport);
	return `(window[Symbol.for("${key}")] ??= []).push(${stringify(data)})`;
}

/**
 * Registers a lazy queue that will be filled with data by `transportDataToJS`.
 * All incoming data will be added either to the rehydration cache or the result cache.
 */
export function registerDataTransport() {
	registerLateInitializingQueue(SSRDataTransport, (data) => {
		const parsed = deserialize<DataToTransport>(data);
		console.log(`received data from the server:`, parsed);
		(window[ResultCacheSymbol] ??= []).push(...parsed.results);
		Object.assign((window[RehydrationCacheSymbol] ??= {}), parsed.rehydrate);
	});
}
