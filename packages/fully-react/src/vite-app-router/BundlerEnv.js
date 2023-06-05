import assert from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { defineFileSystemRoutes } from "../fs-router/index.js";

export const _dirname = dirname(fileURLToPath(import.meta.url));

/**
 *
 * @param {string} path
 * @param {string} name
 * @param {string[]} exts
 * @returns
 */
export const findAny = (
	path,
	name,
	exts = [".js", ".ts", ".jsx", ".tsx", ".mjs", ".mts"],
) => {
	for (const ext of exts) {
		const file = join(path, name + ext);
		if (existsSync(file)) {
			return file;
		}
	}
	return null;
};
// import { defineFileSystemRoutes } from "../fs-router";
// import { generateTypes, prettyPrintRoutes } from "../fs-router/dev";
// import { createNestedPageRoutes } from "../fs-router/nested";
// import { _dirname, findAny } from "./fully-react";

export class BundlerEnv {
	// _serverModules: Set<unknown>;
	// _clientModules: Set<unknown>;
	// _clientDeps: { [key: string]: string[] };
	/** @type {import('vite').UserConfig | null} */
	userConfig;
	/** @type {import('vite').ConfigEnv  | null} */
	configEnv;
	/** @type {import('../component-server/node-worker-client.js').ComponentServerMain | null} */
	#reactServerWorker;

	/** @type {import('vite').ViteDevServer | null} */
	viteServer;
	constructor() {
		this._serverModules = new Set();
		this._clientModules = new Set();
		this._clientDeps = {};

		this.userConfig = null;
		this.configEnv = null;
		this.#reactServerWorker = null;
		this.viteServer = null;
	}

	get reactServerWorker() {
		assert(this.#reactServerWorker, "React server worker not initialized");
		return this.#reactServerWorker;
	}

	set reactServerWorker(worker) {
		this.#reactServerWorker = worker;
	}

	/**
	 *
	 * @param {import("vite").UserConfig} config
	 * @param {import("vite").ConfigEnv} env
	 */
	bootstrap(config, env) {
		this.userConfig = config;
		this.configEnv = env;
	}

	/**
	 *
	 * @param {import('vite').ViteDevServer} server
	 */
	async configureDevServer(server) {
		this.viteServer = server;
		if (!this.isReactServerWorker) {
			let { ComponentServerMain } = await import(
				"../component-server/node-worker-client.js"
			);
			this.reactServerWorker = new ComponentServerMain();
			await this.reactServerWorker.init("", () => {
				server.ws.send("reload-rsc", { msg: "hello" });
			});
			// server.rscWorker = this.reactServerWorker;

			process.on("beforeExit", () => {
				this.close();
			});
		}
	}

	close() {
		if (this.reactServerWorker) {
			this.reactServerWorker.close();
		}
	}

	/**
	 *
	 * @param {import('vite').ResolvedConfig} config
	 */
	configResolved(config) {
		this.viteConfig = config;
	}

	/**
	 *
	 * @param {string} src
	 * @returns
	 */
	clientModuleForServer(src) {
		return Object.entries(this._clientDeps)
			.filter(([k, v]) => v.includes(src))
			.map(([k, v]) => k);
	}

	// generateRouteTypes() {
	// 	const env = {
	// 		manifests: {
	// 			routesManifest: this.routesManifest,
	// 		},
	// 		lazyComponent() {
	// 			return null;
	// 		},
	// 	};
	// 	const routes = createNestedPageRoutes(
	// 		env,
	// 		"root",
	// 		undefined,
	// 		this.routerMode,
	// 	);

	// 	prettyPrintRoutes(routes, 2);

	// 	generateTypes(
	// 		routes,
	// 		this.absoluteAppRoot,
	// 		this.typescriptAppRoot,
	// 		env.manifests.routesManifest,
	// 	);
	// }

	get root() {
		return this.userConfig.root ?? process.cwd();
	}

	get routerMode() {
		return this.router.mode;
	}

	get isClientRouting() {
		return this.routerMode === "client";
	}

	get isServerRouting() {
		return this.routerMode === "server";
	}

	get isServerBuild() {
		return this.configEnv.ssrBuild ?? false;
	}

	get isReactServerBuild() {
		return this.isReactServerWorker && this.isServerBuild;
	}

	get isAppServerBuild() {
		return !this.isReactServerWorker && this.isServerBuild;
	}

	get isClientBuild() {
		return this.configEnv.command === "build" && !this.isServerBuild;
	}

	get clientOutDir() {
		return join("dist", "static");
	}

	get appServerOutDir() {
		return join("dist", "server");
	}

	get reactServerOutDir() {
		return join("dist", "react-server");
	}

	get routesDir() {
		return ".";
	}

	get appRoot() {
		return "app";
	}

	get appRootEntry() {
		return "root.tsx";
	}

	get typescriptAppRoot() {
		return ".vite/app";
	}

	get fullyReactPkgDir() {
		return join(_dirname, "..", "..");
	}

	get isReactServerWorker() {
		return Boolean(process.env.COMPONENT_SERVER_WORKER?.length);
	}

	get needsReactServer() {
		return this.isServerRouting;
	}

	get appServerEntry() {
		return "";
	}

	get routesManifest() {
		if (existsSync(this.absoluteRoutesDir)) {
			// generate route manifest and types
			return defineFileSystemRoutes(this.absoluteRoutesDir);
		}
		return {};
	}

	get pageRoutes() {
		return Object.fromEntries(
			Object.entries(this.routesManifest).filter(([k, v]) => {
				return v.type === "page";
			}),
		);
	}

	get absoluteAppRoot() {
		return join(this.root, this.appRoot);
	}

	get absoluteClientOutDir() {
		return join(this.root, this.clientOutDir);
	}

	get absoluteServerOutDir() {
		return join(this.root, this.appServerOutDir);
	}

	get absoluteReactServerOutDir() {
		return join(this.root, this.reactServerOutDir);
	}

	get absoluteRoutesDir() {
		return join(this.root, this.appRoot, this.routesDir);
	}

	get absoluteTypescriptAppRoot() {
		return this.absoluteAppRoot.replace(/\/app$/, this.typescriptAppRoot);
	}

	get absoluteAppRootEntry() {
		return (
			findAny(this.absoluteAppRoot, "root") ??
			join(this.fullyReactPkgDir, "src", "root.tsx")
		);
	}

	get clientModuleIds() {
		return Array.from(this.clientModules.values());
	}

	set clientDeps(v) {
		this._clientDeps = v;
	}

	get clientEntry() {
		return (
			findAny(this.absoluteAppRoot, "entry-client") ??
			join(this.fullyReactPkgDir, "src", "entry-client.tsx")
		);
	}

	get reactServerEntry() {
		return (
			findAny(this.absoluteAppRoot, "entry-rsc") ??
			join(this.fullyReactPkgDir, "dist", "entry-rsc.production.js")
		);
	}

	get clientDeps() {
		if (this._clientDeps) {
			return this._clientDeps;
		}
		if (existsSync(join(this.absoluteReactServerOutDir, "client-deps.json"))) {
			this._clientDeps = JSON.parse(
				readFileSync(join(this.absoluteReactServerOutDir, "client-deps.json"), {
					encoding: "utf8",
				}),
			);
		}

		return this._clientDeps;
	}

	get clientModules() {
		if (this._clientModules) {
			return this._clientModules;
		}
		let clientModules = [];
		if (
			existsSync(join(this.absoluteReactServerOutDir, "client-manifest.json"))
		) {
			clientModules = JSON.parse(
				readFileSync(
					join(this.absoluteReactServerOutDir, "client-manifest.json"),
					{
						encoding: "utf8",
					},
				),
			);
		}

		this._clientModules = new Set(clientModules);

		return this._clientModules;
	}

	get serverModules() {
		if (this._serverModules) {
			return this._serverModules;
		}

		let serverModules = [];
		if (
			existsSync(join(this.absoluteReactServerOutDir, "server-manifest.json"))
		) {
			serverModules = JSON.parse(
				readFileSync(
					join(this.absoluteReactServerOutDir, "server-manifest.json"),
					{
						encoding: "utf8",
					},
				),
			);
		}

		this._serverModules = new Set(serverModules);

		return this._serverModules;
	}
}
