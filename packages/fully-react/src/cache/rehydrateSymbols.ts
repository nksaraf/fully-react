import { SuperJSONResult } from "superjson/dist/types";

import type { RehydrationCache, ResultsCache } from "../server/types";
import type { DataTransport } from "./dataTransport";

declare global {
	interface Window {
		[RehydrationCacheSymbol]?: RehydrationCache;
		[ResultCacheSymbol]?: ResultsCache;
		[SSRDataTransport]?: DataTransport<SuperJSONResult>;
	}
}
export const RehydrationCacheSymbol = Symbol.for("RehydrationCache");
export const ResultCacheSymbol = Symbol.for("ResultCache");
export const SSRDataTransport = Symbol.for("SSRDataTransport");
