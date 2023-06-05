import createDebug from "@milahu/debug-esm";
import consola from "consola";
import { relative } from "pathe";
import invariant from "tiny-invariant";

import { matchRoutes } from "./match";
import { createModuleMapProxy } from "./webpack";

let logger = createDebug("app");
logger.enabled = true;

export class AppContext {
	clientModuleMap = createModuleMapProxy();

	/** @type {import('./Router.js').Router | null} */
	router;

	/** @type {import('./ModuleLoader.js').ModuleLoader | null} */
	moduleLoader;

	/** @type {string} */
	srcAppRoot;

	/** @type {import('@milahu/debug-esm').Debugger & { context: import('@milahu/debug-esm').Debugger; router: import('@milahu/debug-esm').Debugger; bundler: import('@milahu/debug-esm').Debugger; server: import('@milahu/debug-esm').Debugger } } */
	debug;

	/**
	 *
	 * @param {string} label
	 */
	constructor(label = "app") {
		this.srcAppRoot = import.meta.env.ROOT_DIR;
		this.moduleLoader = null;
		this.router = null;

		let appDebug = createDebug(label);
		appDebug.enabled = true;
		this.debug = Object.assign(appDebug, {
			context: appDebug.extend("context"),
			server: appDebug.extend("server"),
			bundler: appDebug.extend("bundler"),
			router: appDebug.extend("router"),
		});

		this.debug.context.enabled = true;
		this.debug.bundler.enabled = true;
		this.debug.server.enabled = true;
		this.debug.router.enabled = true;
	}

	/**
	 * @return {string | undefined}
	 */
	clientScriptContent() {
		throw new Error("Not implemented");
	}

	/**
	 * @return {string[]}
	 */
	clientModules() {
		throw new Error("Not implemented");
	}

	setup() {
		invariant(this.moduleLoader, "Module loader not initialized");
		this.debug.bundler("setting up webpack env");
		this.moduleLoader.setupWebpackEnv();
	}

	/** @return {React.FC<any>} */
	notFoundComponent() {
		throw new Error("Method not implemented.");
	}

	/**
	 * @return {Record<string, any>}
	 */
	getRouteHandlers() {
		invariant(this.router, "Router not initialized");
		return this.router.getRouteHandlers();
	}

	/**
	 * @param {string} url
	 * @return {[import('./path').Location, import('./match').RouteMatch[] | null]}
	 *
	 */
	matchRoutes(url) {
		invariant(this.router, "Router not initialized");
		return this.router.matchRoutes(url);
	}

	pageRoutes() {
		invariant(this.router, "Router not initialized");
		return this.router.pageRoutes();
	}

	/**
	 * @param {Request} request
	 * @return {Promise<any[]>}
	 */
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	async findAssets(request) {
		throw new Error("Not implemented");
	}

	/**
	 * Load a module appropriately for the environment you are in.
	 *
	 * Works on node, worker and browser runtimes
	 * During production, it will only load modules that were built
	 * with the app and doesn't allow arbitrary access to local modules
	 *
	 * @param {string} id
	 * @returns
	 */
	async loadModule(id) {
		invariant(this.moduleLoader, "Module loader not initialized");
		this.debug.bundler("load", id);
		return this.moduleLoader.load(id);
	}

	/**
	 *
	 * @param {Request} request
	 */
	getDependenciesForURL(request) {
		/** @type {string[]} */
		const inputs =
			matchRoutes(this.pageRoutes(), new URL(request.url).pathname)?.map(
				(r) => {
					if (!r.route?.file) {
						/** @type {any} */
						let a = undefined;
						return a;
					}
					return relative(import.meta.env.ROOT_DIR, r.route?.file);
				},
			) ?? [];

		inputs.push(
			relative(import.meta.env.ROOT_DIR, import.meta.env.APP_ROOT_ENTRY),
		);

		return inputs;
	}
}
