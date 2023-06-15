import "@hattip/adapter-node";
import reactRefresh from "@vitejs/plugin-react";
import invariant from "tiny-invariant";
import tsconfigPaths from "vite-tsconfig-paths";

import { createRequire } from "node:module";

import { collectStyles } from "./app-context/find-assets.js";
import { setApp } from "./app/index.js";
import { serverComponents } from "./dev-server/server-components/index.js";
import { App } from "./vite-app-router/App.js";
import connect from "./winterkit/connect.js";

export const require = createRequire(import.meta.url);

function createViteApp() {
	let app = new App();
	setApp(app);
	app.initializeBundler();
	return app;
}

process.on(
	"unhandledRejection",
	/** @param {Error | string} err */ (err) => {
		// import.meta.app.debug(
		// 	`An unhandled error occured: ${
		// 		typeof err === "string" ? err : err.stack || err
		// 	}`,
		// );
	},
);

/**
 * @param {{ configs:import("vite").UserConfig[], routers: [] }} config
 * @returns {import("vite").Plugin[]}
 */
function app(config) {
	let app = createViteApp();

	/**
	 *
	 * @param {string} id
	 * @returns
	 */
	function virtual(id) {
		return `\0${id}`;
	}

	// function isVirtual(id) {
	// 	return id.startsWith("\0");
	// }

	return [
		{
			name: "app",
			enforce: "pre",
			closeWatcher() {
				app.bundler.close();
			},
			configResolved(config) {
				app.bundler.configResolved(config);
			},
			config(config, env) {
				app.bundler.bootstrap(config, env);
				return {
					ssr: {
						external: ["minimatch"],
						noExternal: ["fully-react", "react-error-boundary"],
					},
					resolve: {
						alias: {
							"~": app.bundler.absoluteAppRoot,
						},
						conditions: app.bundler.isReactServerWorker
							? ["node", "import", "react-server", "production"]
							: [],
					},
					define: {
						"import.meta.app.ROUTER_MODE": `"client"`,
						"import.meta.app.ROOT_DIR": JSON.stringify(app.bundler.root),
						"import.meta.app.ROOT_ENTRY": JSON.stringify(
							app.bundler.absoluteAppRootEntry,
						),
						"import.meta.app.CLIENT_ENTRY": JSON.stringify(
							app.bundler.clientEntry,
						),
						"import.meta.app": "globalThis[Symbol.for('App')]",
						"import.meta.env.APP_ROUTER_MODE": `"client"`,
						"import.meta.env.APP_CLIENT_ENTRY": JSON.stringify(
							app.bundler.clientEntry,
						),
						"import.meta.env.APP_ROOT_ENTRY": JSON.stringify(
							app.bundler.absoluteAppRootEntry,
						),
						"import.meta.env.APP_ROOT_DIR": JSON.stringify(app.bundler.root),
					},
				};
			},
			async configureServer(server) {
				await app.bundler.configureDevServer(server);

				return () => {
					server.middlewares.use(async (req, res) => {
						// Restore the original URL (SPA middleware may have changed it)
						req.url = req.originalUrl || req.url;
						await app.initializeWebServer();
						await app.webServer.handleNodeRequest(req, res);
						return true;
					});
				};
			},
			resolveId(id) {
				if (id.startsWith("app:")) {
					return virtual(id) + ".tsx";
				}
			},
			async transform(code, id, { ssr }) {
				if (!ssr) {
					let [path, query] = id.split("?");

					let searchParams = new URLSearchParams(query);

					if (searchParams.get("asset") != null) {
						console.log({ path, asset: searchParams.get("asset") });
						invariant(app.bundler.viteServer, "Vite server not initialized");
						let assets = await collectStyles(app.bundler.viteServer, [path]);
						return `export default ${JSON.stringify(assets)}`;
					}

					return code.replaceAll(
						"import.meta.app",
						"globalThis[Symbol.for('App')]",
					);
				}
			},
			load(id) {
				if (id === virtual("app:react-routes.tsx")) {
					const code = `
					import { lazy, createElement, forwardRef, Fragment, useLayoutEffect } from 'react'
					function lazyRoute(id, fn) {
						console.log(id, fn)
						return lazy(async () => {
							let updateStyle, removeStyle;
							if (typeof window !== 'undefined' && import.meta.hot) {
								const client = await import('/@vite/client');
								updateStyle = client.updateStyle;
								removeStyle = client.removeStyle;
							}
							const { default: Component } = await fn();
							console.log(Component)
							const styles = await import.meta.app.moduleLoader.findAssetsForModules([id]);
							import.meta.app.debug(styles);

							const Comp = forwardRef((props, ref) => {
								useLayoutEffect(() => {
									Object.keys(styles).forEach((style) => {
										if (typeof window !== 'undefined' && !document.querySelector(\`style[data-vite-dev-id="${process.cwd()}\${style}"]\`)) {
											// const link = document.createElement('style');
											// link.setAttribute('data-vite-dev-id', \`${process.cwd()}\${style}\`);
											// link.innerHTML = styles[style];
											import.meta.app.debug('mounting', style);
											// document.head.appendChild(link);
											updateStyle(\`${process.cwd()}\${style}\`, styles[style])

										}
									})
									return () => {
										Object.keys(styles).forEach((style) => {
											// remove all the link tags with style as href
											const links = document.querySelectorAll(\`link[href="\${style}"]\`);
											for (const link of links) {
												link.remove();
											}

											// const links2 = document.querySelectorAll(\`style[data-vite-dev-id="${process.cwd()}\${style}"]\`);
											// for (const link of links2) {
											// 	link.remove();
											// }

											removeStyle(\`${process.cwd()}\${style}\`)
											import.meta.app.debug('unmounting', style);

										});
									}
								}, [])
								return createElement(Fragment, null, createElement(Component, {...props, ref: ref }),
								...Object.keys(styles).map((style) => {
									return createElement('link', { rel: "stylesheet", href: style, precedence: "default" })
								})
								);
							})
							return { default: Comp };
						});
					}
					export default ${JSON.stringify(app.bundler.pageRoutes, (k, v) => {
						if (k === "file") {
							return `_$lazyRoute('${v}', () => import('${v}'))$_`;
						}
						return v;
					})}`;
					return code.replaceAll('"_$l', "l").replaceAll(')$_"', ")");
				}
			},
		},
	];
}

/**
 *
 * @param {import('vite').UserConfig} config
 */
export function defineConfig(config) {
	return config;
}

export function react(
	/** @type {import("./vite-app-router/App.js").AppOptions} */ _appOptions = {},
) {
	let options = Object.assign(
		{},
		{
			tsconfigPaths: true,
			hmr: true,
		},
		_appOptions,
	);
	return [
		app(),
		options.tsconfigPaths ? tsconfigPaths() : undefined,
		options.hmr ? reactRefresh() : undefined,
		connect(),
		serverComponents(),
	];
}

export default react;
