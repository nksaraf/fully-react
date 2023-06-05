import type { ModuleMap } from "react-server-dom-webpack/server.edge";
import type { Manifest } from "vite";

import type { RouteManifest } from "../fs-router/types";
import type { AppContext } from "./AppContext";

export type AssetDesc = string | { type: "style"; style: string; src?: string };
export type { ModuleMap, AppContext };
export type { RouteManifest };
export type { Manifest as BuildManifest };

export const AppContextSymbol = Symbol.for("AppContext");

export function setContext(context: AppContext) {
	(globalThis as any)[AppContextSymbol] = context;
}

export function getContext(): AppContext {
	return (globalThis as any)[AppContextSymbol];
}
