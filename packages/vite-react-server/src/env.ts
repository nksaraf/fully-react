import type { RenderToReadableStreamOptions } from "react-dom/server";
import type { Manifest } from "vite";
import type { ModuleMap } from "./types";
import type { RouteManifest } from "./fs-router/types";

export type Env = {
	clientModuleMap: ModuleMap;
	components: { [key: string]: any };
	findAssets: () => Promise<Array<string | { type: string }>>;
	routesConfig: { [key: string]: any };
	manifests?: {
		buildAppRoot: string;
		srcAppRoot: string;
		clientManifest: Manifest;
		serverManifest: Manifest;
		reactServerManifest: Manifest;
		routesConfig: RouteManifest;
		findInServerManifest(chunk: string): string;
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
