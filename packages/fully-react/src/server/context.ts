import type { Manifest } from "vite";
import type { ModuleMap } from "react-server-dom-webpack/server.edge";
import type { RenderToReadableStreamOptions } from "react-dom/server";
import type { RouteManifest } from "../fs-router/types";
import { ServerContext } from "./ServerContext";
export type AssetDesc = string | { type: "style"; style: string; src?: string };

export type { ModuleMap };
export type { RouteManifest };
export type { Manifest as BuildManifest };

export type Context = ServerContext;

// export type Context = {
// 	clientModuleMap: ModuleMap;
// 	findAssets: () => Promise<Array<AssetDesc>>;
// 	manifests:
// 		| {
// 				mode: "build";
// 				buildAppRoot: string;
// 				srcAppRoot: string;
// 				clientManifest: Manifest;
// 				serverManifest: Manifest;
// 				reactServerManifest: Manifest;
// 				routesManifest: RouteManifest;
// 				findInServerManifest(chunk: string): string;
// 		  }
// 		| {
// 				mode: "dev";
// 				routesManifest: RouteManifest;
// 		  };
// 	loadModule(id: string): Promise<any>;
// 	lazyComponent(id: string): React.FC<any>;
// } & RenderToReadableStreamOptions;

declare global {
	var context: ServerContext;
}

export const context: ServerContext = new Proxy(globalThis.context, {
	get: (target, prop: keyof ServerContext) => globalThis.context[prop],
});

export default context;
