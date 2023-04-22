import type { Manifest } from "vite";
import type { ModuleMap } from "react-server-dom-webpack/server.edge";
import type { RenderToReadableStreamOptions } from "react-dom/server";
import type { RouteManifest } from "../fs-router/types";
export type AssetDesc = string | { type: "style"; style: string; src?: string };

export type { ModuleMap };
export type { RouteManifest };
export type { Manifest as BuildManifest };
export type Env = {
	clientModuleMap: ModuleMap;
	findAssets: () => Promise<Array<AssetDesc>>;
	manifests:
		| {
				mode: "build";
				buildAppRoot: string;
				srcAppRoot: string;
				clientManifest: Manifest;
				serverManifest: Manifest;
				reactServerManifest: Manifest;
				routesManifest: RouteManifest;
				findInServerManifest(chunk: string): string;
		  }
		| {
				mode: "dev";
				routesManifest: RouteManifest;
		  };
	loadModule(id: string): Promise<any>;
	lazyComponent(id: string): React.FC<any>;
} & RenderToReadableStreamOptions;

declare global {
	var env: Env;
}

export const env: Env = new Proxy(globalThis.env, {
	get: (target, prop: keyof Env) => globalThis.env[prop],
});

export default env;
