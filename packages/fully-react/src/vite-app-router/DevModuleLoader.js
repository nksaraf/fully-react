import { relative } from "pathe";

import { collectStyles } from "../app-context/find-styles";
import { ModuleLoader } from "./ModuleLoader";

export class DevModuleLoader extends ModuleLoader {
	/** @type {import('vite').ViteDevServer} */
	devServer;

	/**
	 *
	 * @param {import('vite').ViteDevServer} devServer
	 */
	constructor(devServer) {
		super();
		this.devServer = devServer;
	}

	/**
	 * @param {string} id
	 */
	async load(id) {
		if (id.startsWith("/") || id.startsWith("./") || id.startsWith("../")) {
			return await this.devServer.ssrLoadModule(`/@fs${id}`);
		}
		return await this.devServer.ssrLoadModule(id);
	}

	async findAssetsForModules(/** @type {string[]} */ modules) {
		const styles = await collectStyles(
			this.devServer,
			modules.filter((i) => !!i),
		);

		return styles;
	}

	/**
	 * @param {Request} request
	 * @return {Promise<any[]>}
	 */
	async findAssets(request) {
		let deps = this.getDependenciesForURL(request);
		return await this.findAssetsForModules([]);
	}

	/**
	 *
	 * @param {Request} request
	 */
	getDependenciesForURL(request) {
		/** @type {string[]} */
		// const inputs =
		// 	matchRoutes(this.pageRoutes(), new URL(request.url).pathname)?.map(
		// 		(r) => {
		// 			if (!r.route?.file) {
		// 				/** @type {any} */
		// 				let a = undefined;
		// 				return a;
		// 			}
		// 			return relative(import.meta.env.ROOT_DIR, r.route?.file);
		// 		},
		// 	) ?? [];

		const inputs = [];
		inputs.push(relative(import.meta.app.ROOT_DIR, import.meta.app.ROOT_ENTRY));

		return inputs;
	}
}
