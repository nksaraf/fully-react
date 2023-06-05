import createDebug from "@milahu/debug-esm";
import invariant from "tiny-invariant";

import { fileURLToPath } from "node:url";

import { BundlerEnv } from "./BundlerEnv.js";

class InternalRequest {
	/** @type {string} */
	url;
	/** @type {string} */
	method;
	/** @type {Headers} */
	headers;
	constructor(url, method, headers) {
		this.url = url;
		this.method = method;
		this.headers = headers;
	}

	/** @type {any} */
	body;
	/** @type {any} */
	cookies;
	/** @type {any} */
	params;
	/** @type {any} */
	query;
	/** @type {any} */
	session;
	/** @type {any} */
	locals;
}

export class App {
	/** @type {Router} */
	_router;

	/**
	 *
	 * @param {Request} src
	 */
	async fetch(src, url) {
		return this.webServer.fetch(src, url);

		// console.log(src);
		// if (url.searchParams.get("rsc")) {
		// }
		// await this.initializeRenderer();
		// return this.renderer.fetch(src, props);
	}

	/** @type {import('./Renderer.js').Renderer | null} */
	_renderer;

	get renderer() {
		invariant(this._renderer, "renderer is not set");
		return this._renderer;
	}
	/**
	 *
	 * @param {string} component
	 * @param {any} props
	 */
	async fetchServerComponent(component, props) {
		this.debug.router("fetching", component, props);
		// if (process.env.COMPONENT_SERVER_WORKER) {
		// 	if (!this._webServer) {
		// 		invariant(this.bundler.viteServer, "viteServer is not set");
		// 		const { DevWebServer } = await this.bundler.viteServer.ssrLoadModule(
		// 			fileURLToPath(new URL("./DevWebServer.js", import.meta.url)),
		// 		);
		// 		this._webServer = new DevWebServer(
		// 			this.bundler.viteServer,
		// 			this.bundler,
		// 		);
		// 		this.webServer.context.setup();
		// 	}

		// 	invariant(this.bundler.viteServer, "viteServer is not set");

		// 	this.debug.router("rendering", component, props);
		// 	const { default: Component } = await this.moduleLoader.load(component);

		// 	const { ComponentServer } = await this.bundler.viteServer.ssrLoadModule(
		// 		fileURLToPath(new URL("./ComponentServer.js", import.meta.url)),
		// 	);

		// 	let request = new Request(props.url, {
		// 		headers: props.headers,
		// 		method: props.method,
		// 	});

		// 	return new ComponentServer().renderToReadableStream(
		// 		request,
		// 		createElement(Component, props),
		// 	);
		// } else {
		// 	return this.bundler.reactServerWorker.renderToReadableStream(
		// 		component,
		// 		props,
		// 	);
		// }
	}

	/**
	 * Only available in DEV_SERVER, BUILD environments
	 * @type {import('./BundlerEnv.js').BundlerEnv | null}
	 **/
	_bundler;

	/**
	 * @type {import('./ModuleLoader.js').ModuleLoader | null}
	 */
	_moduleLoader;

	/**
	 * @type {import('./DevWebServer.js').DevWebServer | null}
	 * @private
	 */
	_webServer;

	constructor() {
		this._webServer = null;
		this._bundler = null;
		this._moduleLoader = null;
		this._renderer = null;
		this._debug = null;

		this.initializeDebug();
	}

	get bundler() {
		invariant(this._bundler, "bundler is not set");
		return this._bundler;
	}

	get webServer() {
		invariant(this._webServer, "webServer is not set");
		return this._webServer;
	}

	get moduleLoader() {
		invariant(this._moduleLoader, "moduleLoader is not set");
		return this._moduleLoader;
	}

	initializeBundler() {
		this._bundler = new BundlerEnv();
	}

	async initializeDebug() {
		let appDebug = createDebug("app");
		appDebug.enabled = true;
		this._debug = Object.assign(appDebug, {
			context: appDebug.extend("context"),
			server: appDebug.extend("server"),
			bundler: appDebug.extend("bundler"),
			router: appDebug.extend("router"),
		});

		this._debug.context.enabled = true;
		this._debug.bundler.enabled = true;
		this._debug.server.enabled = true;
		this._debug.router.enabled = true;
	}

	async initializeRenderer() {
		const { ReactRenderer } = await this.moduleLoader.load(
			fileURLToPath(new URL("../react/html/ReactRenderer.js", import.meta.url)),
		);
		console.log("ReactRenderer", ReactRenderer);
		this._renderer = new ReactRenderer(this);
	}

	async initializeWebServer() {
		invariant(this.bundler.viteServer, "viteServer is not set");
		const { DevModuleLoader } = await this.bundler.viteServer.ssrLoadModule(
			fileURLToPath(new URL("./DevModuleLoader.js", import.meta.url)),
		);
		this._moduleLoader = new DevModuleLoader(this.bundler.viteServer);
		const { DevWebServer } = await this.moduleLoader.load(
			fileURLToPath(new URL("./DevWebServer.js", import.meta.url)),
		);
		this._webServer = new DevWebServer(this);
		// this.webServer.context.setup();
	}

	/** @type {import('@milahu/debug-esm').Debugger & { context: import('@milahu/debug-esm').Debugger; router: import('@milahu/debug-esm').Debugger; bundler: import('@milahu/debug-esm').Debugger; server: import('@milahu/debug-esm').Debugger } | null} */
	_debug;

	get debug() {
		invariant(this._debug, "debug is not set");
		return this._debug;
	}

	routeManifest
	pageRoutes() {}
}
