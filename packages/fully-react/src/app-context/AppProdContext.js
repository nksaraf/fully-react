import { join, relative } from "pathe";
import invariant from "tiny-invariant";

import { AppContext } from "./AppContext";
import { ModuleLoader } from "./ModuleLoader";
import { Router } from "./Router";
import { findAssetsInManifest } from "./manifest";
import { readJSON } from "./nested-router";

class ProdModuleLoader extends ModuleLoader {
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
	}

	async load(/** @type {string} */ id) {
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
}

export class AppProdContext extends AppContext {
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
		this.moduleLoader = new ProdModuleLoader();
		this.router = new Router(
			readJSON(join(this.buildAppRoot, "dist", "server", "routes.json")),
			this.moduleLoader,
		);
	}

	clientModules() {
		return [
			`/${
				this.clientManifest[
					relative(import.meta.env.ROOT_DIR, import.meta.env.APP_CLIENT_ENTRY)
				].file
			}`,
		];
	}

	clientScriptContent() {
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

	/**
	 *
	 * @param {Request} request
	 * @returns
	 */
	async findAssets(request) {
		let deps = this.getDependenciesForURL(request);
		return await this.findAssetsForModules(deps);
	}
}
