import { DevModuleLoader } from "../vite-app-router/DevModuleLoader";
import { AppContext } from "./AppContext";
import { Router } from "./Router";
import { collectStyles } from "./find-styles";

export class AppDevContext extends AppContext {
	/** @type {import('vite').ViteDevServer} */
	devServer;

	/**
	 *
	 * @param {import('vite').ViteDevServer } devServer
	 * @param {string} label
	 */
	constructor(
		devServer,
		label,
		moduleLoader = new DevModuleLoader(devServer),
		router = new Router(devServer.routesManifest, moduleLoader),
	) {
		super(label);
		this.devServer = devServer;
		this.moduleLoader = moduleLoader;
		this.router = router;
	}

	clientModules() {
		return [`/@fs${import.meta.env.APP_CLIENT_ENTRY}`];
	}

	clientScriptContent() {
		return undefined;
	}

	async findAssetsForModules(/** @type {string[]} */ modules) {
		const styles = await collectStyles(
			this.devServer,
			modules.filter((i) => !!i),
		);

		return [...Object.entries(styles ?? {}).map(([key, value]) => key)];
	}

	/**
	 * @param {Request} request
	 * @return {Promise<any[]>}
	 */
	async findAssets(request) {
		let deps = this.getDependenciesForURL(request);
		return await this.findAssetsForModules(deps);
	}
}
