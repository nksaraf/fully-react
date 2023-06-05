import { lazy } from "react";

import { setupWebpackEnv } from "../app-context/webpack";

export class ModuleLoader {
	setupWebpackEnv() {
		setupWebpackEnv(this.load.bind(this));
	}

	/**
	 *
	 * @param {string} id
	 * @returns
	 */
	async load(id) {
		return await import(/* @vite-ignore */ id);
	}

	/**
	 * @param {string} id
	 * @returns {any}
	 *
	 */
	lazy(id) {
		return lazy(() => this.load(id));
	}
}
