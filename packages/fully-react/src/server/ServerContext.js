import { relative, join } from "pathe";
import { readFileSync } from "node:fs";
import viteDevServer from "../dev-server";
import { lazy, createElement, useMemo } from "react";
import { createLocation, createPath } from "../fs-router/path";
import { matchRoutes } from "../fs-router/utils";
import { createModuleMapProxy, setupWebpackEnv } from "./webpack";
import { collectStyles } from "./dev/find-styles";
import invariant from "tiny-invariant";
import { findAssetsInManifest } from "./findAssetsInManifest";

// Create a map of routes by parentId to use recursively instead of
// repeatedly filtering the manifest.
export function groupRoutesByParentId(
	/** @type {import('types').RouteManifest} */
	manifest,
) {
	/** @type {Record<string, import('types').RouteManifest[string][]>} */
	const routes = {};

	Object.values(manifest).forEach((route) => {
		const parentId = route.parentId || "";
		if (!routes[parentId]) {
			routes[parentId] = [];
		}
		routes[parentId].push(route);
	});

	return routes;
}

const isServer = typeof window === "undefined";

/**
 *
 * @param {ServerContext} env
 * @param {*} parentId
 * @param {*} routesByParentId
 * @param {*} routerMode
 * @returns
 */
export function createNestedPageRoutes(
	/** @type {ServerContext} */
	env,
	parentId = "",
	routesByParentId = groupRoutesByParentId(env.routeManifest || {}),
	/** @type {string} */
	routerMode,
) {
	return (routesByParentId[parentId] || [])
		.map((/** @type {any} */ route) => {
			if (route.type === "route") {
				return undefined;
			}

			const path =
				(route.path?.length ?? 0) > 0 && route.path?.endsWith("/")
					? route.path.slice(0, -1)
					: route.path;

			const dataRoute = {
				id: route.id,
				path,
				caseSensitive: route.caseSensitive,
				/** @type {any[] | undefined} */
				children: undefined,
				index: route.index,
				file: route.file,
				component:
					typeof route.file === "string"
						? isServer
							? routerMode === "client"
								? (/** @type {any} */ props) => {
										const Component = useMemo(
											() => env.lazyComponent(route.file),
											[],
										);
										return createElement(Component, props);
								  }
								: (/** @type {any} */ props) => {
										const Component = env.lazyComponent(route.file);
										return createElement(Component, props);
								  }
							: env.lazyComponent(route.file)
						: lazy(route.file),
			};

			const children = createNestedPageRoutes(
				env,
				route.id,
				routesByParentId,
				routerMode,
			);
			if (children.length > 0) dataRoute.children = children;
			return dataRoute;
		})
		.filter(Boolean);
}

/**
 *
 * @param {string} path
 * @returns
 */
function readJSON(path) {
	return JSON.parse(readFileSync(path, "utf-8"));
}

export class ServerContext {
	clientModuleMap = createModuleMapProxy();

	/** @type {import('types').RouteManifest} */
	routeManifest;

	/** @type {string} */
	srcAppRoot;

	constructor() {
		this.srcAppRoot = import.meta.env.ROOT_DIR;
		this.routeManifest = {};
	}

	/**
	 * @return {string | undefined}
	 */
	bootstrapScriptContent() {
		throw new Error("Not implemented");
	}

	/**
	 * @return {string[]}
	 */
	bootstrapModules() {
		throw new Error("Not implemented");
	}

	setupWebpackEnv() {
		setupWebpackEnv(this.loadModule.bind(this));
		// throw new Error("Method not implemented.");
	}

	/**
	 * @return {Record<string, any>}
	 */
	getRouteHandlers() {
		return Object.fromEntries(
			Object.entries(this.routeManifest).filter(
				([key, value]) => value.type === "route",
			),
		);
	}

	/** @return {React.FC<any>} */
	notFoundComponent() {
		throw new Error("Method not implemented.");
	}
	/**
	 * @param {string} url
	 * @return {[import('../fs-router/path').Location, import('../fs-router/utils').RouteMatch[] | null]}
	 *
	 */
	matchRoutes(url) {
		const basename = "/";
		const location = createLocation(
			"",
			createPath(new URL(url)),
			null,
			"default",
		);
		return [location, matchRoutes(this.pageRoutes(), location, basename)];
	}

	pageRoutes() {
		let pageRoutes = createNestedPageRoutes(
			this,
			"root",
			undefined,
			import.meta.env.ROUTER_MODE,
		);

		return pageRoutes;
	}

	/**
	 *
	 * @param {string} id
	 * @returns
	 */
	async loadModule(id) {
		return await import(/* @vite-ignore */ id);
	}

	/**
	 * @param {string} id
	 * @returns {any}
	 *
	 */
	lazyComponent(id) {
		return lazy(() => this.loadModule(id));
	}

	/**
	 * @param {string} id
	 * @return {Promise<any[]>}
	 */
	async findAssets(id) {
		return [];
	}

	/**
	 *
	 * @param {string} route
	 */
	getDependenciesForURL(route) {
		/** @type {string[]} */
		const inputs =
			matchRoutes(this.pageRoutes(), "/")?.map((r) => {
				if (!r.route?.file) {
					/** @type {any} */
					let a = undefined;
					return a;
				}
				return relative(import.meta.env.ROOT_DIR, r.route?.file);
			}) ?? [];

		inputs.push(
			relative(import.meta.env.ROOT_DIR, import.meta.env.APP_ROOT_ENTRY),
		);

		return inputs;
	}
}

export class ProdServerContext extends ServerContext {
	/** @type {string} */
	buildAppRoot;

	/** @type {import("./context").BuildManifest} */
	clientManifest;

	/**  @type {any} */
	clientSSRManifest;

	/**  @type {import("./context").BuildManifest} */
	serverManifest;

	/**  @type {import("./context").BuildManifest | undefined} */
	clientDepsManifest;

	/**  @type {import("./context").BuildManifest | undefined} */
	componentServerManifest;

	constructor() {
		super();
		this.srcAppRoot = import.meta.env.ROOT_DIR;
		this.buildAppRoot = join(this.srcAppRoot, process.env.OUT_ROOT_DIR ?? ".");

		this.clientManifest = readJSON(
			join(this.buildAppRoot, "dist", "server", "static-manifest.json"),
		);

		this.clientSSRManifest = readJSON(
			join(this.buildAppRoot, "dist", "server", "static-ssr-manifest.json"),
		);

		this.serverManifest = readJSON(
			join(this.buildAppRoot, "dist", "server", "manifest.json"),
		);

		this.clientDepsManifest = undefined;
		this.componentServerManifest = undefined;
		if (import.meta.env.ROUTER_MODE === "server") {
			this.clientDepsManifest = readJSON(
				join(this.buildAppRoot, "dist", "react-server", "client-deps.json"),
			);

			this.componentServerManifest = readJSON(
				join(
					this.buildAppRoot,
					"dist",
					"server",
					"react-server",
					"manifest.json",
				),
			);
		}

		this.routeManifest = readJSON(
			join(this.buildAppRoot, "dist", "server", "routes.json"),
		);
	}

	bootstrapModules() {
		return [
			`/${
				this.clientManifest[
					relative(import.meta.env.ROOT_DIR, import.meta.env.CLIENT_ENTRY)
				].file
			}`,
		];
	}

	bootstrapScriptContent() {
		if (import.meta.env.ROUTER_MODE === "server") {
			invariant(this.clientDepsManifest, "clientDepsManifest is undefined");
			invariant(
				this.componentServerManifest,
				"reactServerManifest is undefined",
			);

			return `window.manifest = ${JSON.stringify({
				root: process.cwd(),
				client:
					import.meta.env.ROUTER_MODE === "server"
						? Object.fromEntries(
								Object.entries(this.clientDepsManifest).map(([key, asset]) => [
									key,
									this.clientSSRManifest[
										relative(import.meta.env.ROOT_DIR, key)
									][0],
								]),
						  )
						: undefined,
			})};`;
		} else {
			return `window.manifest = ${JSON.stringify({
				root: process.cwd(),
				client: undefined,
			})};`;
		}
	}

	async loadModule(/** @type {string} */ id) {
		const url = this.findInServerManifest(id);
		const mod = await import(/* @vite-ignore */ url);
		return mod;
	}

	chunkId(/** @type {string} */ chunk) {
		return relative(this.srcAppRoot, chunk);
	}

	findInServerManifest(/** @type {string} */ chunk) {
		const file = this.serverManifest[this.chunkId(chunk)];
		if (file) {
			return join(
				this.buildAppRoot,
				"dist",
				"server",
				this.serverManifest[this.chunkId(chunk)].file,
			);
		} else if (import.meta.env.ROUTER_MODE === "server") {
			invariant(
				this.componentServerManifest,
				"componentServerManifest is undefined",
			);
			return join(
				this.buildAppRoot,
				"dist",
				"server",
				"react-server",
				this.componentServerManifest[this.chunkId(chunk)].file,
			);
		} else {
			throw new Error(`Could not find ${chunk} in server manifest`);
		}
	}

	async findAssetsForModules(/** @type {string[]} */ modules) {
		return modules?.map((i) => this.findAssetsForModule(i)).flat() ?? [];
	}

	findAssetsForModule(/** @type {string} */ module) {
		if (import.meta.env.ROUTER_MODE === "server") {
			invariant(
				this.componentServerManifest,
				"componentServerManifest is undefined",
			);
			return [
				...findAssetsInManifest(this.serverManifest, module)
					.filter((asset) => !asset.endsWith(".js"))
					.map((asset) => `/${asset}`),
				...(import.meta.env.ROUTER_MODE === "server"
					? findAssetsInManifest(this.componentServerManifest, module)
							.filter((asset) => !asset.endsWith(".js"))
							.map((asset) => `/${asset}`)
					: []),
			];
		}

		return [
			...findAssetsInManifest(this.serverManifest, module)
				.filter((asset) => !asset.endsWith(".js"))
				.map((asset) => `/${asset}`),
		];
	}

	async findAssets() {
		let deps = this.getDependenciesForURL("/");
		return await this.findAssetsForModules(deps);
	}
}

export class DevServerContext extends ServerContext {
	/** @type {import('vite').ViteDevServer} */
	viteServer;

	constructor() {
		super();
		this.viteServer = viteDevServer;
		this.routeManifest = viteDevServer.routesManifest;
	}

	bootstrapModules() {
		return [`/@fs${import.meta.env.CLIENT_ENTRY}`];
	}

	bootstrapScriptContent() {
		return undefined;
	}

	/**
	 * @param {string} id
	 */
	async loadModule(id) {
		return await viteDevServer.ssrLoadModule(id);
	}

	/**
	 * @param {string} id
	 */
	lazyComponent(id) {
		const importPath = `/@fs${id}`;
		return lazy(
			async () =>
				// @ts-expect-error - vite doesnt know this is exporting a component
				await this.viteServer.ssrLoadModule(/* @vite-ignore */ importPath),
		);
	}

	chunkId(/** @type {string} */ chunk) {
		return relative(this.srcAppRoot, chunk);
	}

	async findAssetsForModules(/** @type {string[]} */ modules) {
		const styles = await collectStyles(
			this.viteServer,
			modules.filter((i) => !!i),
		);

		return [...Object.entries(styles ?? {}).map(([key, value]) => key)];
	}

	async findAssets() {
		let deps = this.getDependenciesForURL("/");
		return await this.findAssetsForModules(deps);
	}
}
