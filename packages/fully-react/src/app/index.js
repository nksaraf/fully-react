// import type { ModuleMap } from "react-server-dom-webpack/server.edge";
// import type { Manifest } from "vite";
// import type { RouteManifest } from "../fs-router/types";
import invariant from "tiny-invariant";

// export type AssetDesc = string | { type: "style"; style: string; src?: string };
// export type { ModuleMap };
// export type { RouteManifest };
// export type { Manifest as BuildManifest };

export const AppSymbol = Symbol.for("App");

/**
 * @param {import('../vite-app-router/App').App} context
 */
export function setApp(context) {
	// @ts-ignore
	globalThis[AppSymbol] = context;
}

/**
 * @returns {import('../vite-app-router/App').App}
 */
export function getApp() {
	// @ts-ignore
	invariant(globalThis[AppSymbol], "App not initialized");
	// @ts-ignore
	return globalThis[AppSymbol];
}
