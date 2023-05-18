import {
	createLogger,
	ViteDevServer,
	type Plugin,
	ResolvedConfig,
	ConfigEnv,
	UserConfig,
} from "vite";
import path, { dirname, join } from "node:path";
import { cpSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { defineFileSystemRoutes } from "../fs-router";
import { generateTypes, prettyPrintRoutes } from "../fs-router/dev";
import { createNestedPageRoutes } from "../fs-router/nested";
import { Context, RouteManifest } from "../server/context";
import {
	ComponentServerWorker,
	createComponentServerWorker as createComponentServerWorker,
} from "../component-server/node-worker-client";
import invariant from "tiny-invariant";
import { fileURLToPath } from "node:url";
import { ConfigPageRoute } from "../fs-router/types";
import assert from "node:assert";

export const logger = createLogger("info", {});

const findAny = (
	path: string,
	name: string,
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

export const _dirname = dirname(fileURLToPath(import.meta.url));

class BundlerEnv {
	#serverModules: Set<unknown>;
	#clientModules: Set<unknown>;
	#clientDeps: {};
	#userConfig: {};
	#configEnv: {};
	#reactServerWorker: ComponentServerWorker | null;
	#vite: ViteDevServer | null;
	constructor() {
		this.#serverModules = new Set();
		this.#clientModules = new Set();
		this.#clientDeps = {};

		this.#userConfig = {};
		this.#configEnv = {};
		this.#reactServerWorker = null;
		this.#vite = null;
	}

	get reactServerWorker() {
		assert(this.#reactServerWorker, "React server worker not initialized");
		return this.#reactServerWorker;
	}

	set reactServerWorker(worker) {
		this.#reactServerWorker = worker;
	}

	bootstrap(config, env) {
		this.userConfig = config;
		this.configEnv = env;
	}

	async configureDevServer(server) {
		server.routesManifest = this.routesManifest;
		if (!this.isReactServerWorker) {
			this.reactServerWorker = await createComponentServerWorker("", () => {
				server.ws.send("reload-rsc", { msg: "hello" });
			});
			server.rscWorker = this.reactServerWorker;

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

	configResolved(config) {
		this.vite = config;
		if (this.isReactServerBuild && config.serverComponents) {
			this._serverModules = config.serverComponents.serverModules;
			this._clientModules = config.serverComponents.clientModules;
		}
	}

	clientModuleForServer(src) {
		return Object.entries(this._clientDeps)
			.filter(([k, v]) => v.includes(src))
			.map(([k, v]) => k);
	}

	generateRouteTypes() {
		const env = {
			manifests: {
				routesManifest: this.routesManifest,
			},
			lazyComponent() {
				return null;
			},
		};
		const routes = createNestedPageRoutes(
			env,
			"root",
			undefined,
			this.routerMode,
		);

		prettyPrintRoutes(routes, 2);

		generateTypes(
			routes,
			this.absoluteAppRoot,
			this.typescriptAppRoot,
			env.manifests.routesManifest,
		);
	}

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
		return join(_dirname, "..");
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
			clientEntry ??
			findAny(this.absoluteAppRoot, "entry-client") ??
			join(this.fullyReactPkgDir, "src", "entry-client.tsx")
		);
	}

	get reactServerEntry() {
		return (
			rscEntry ??
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

const createBundlerEnv = ({
	router,
	clientEntry,
	rscEntry,
}: {
	clientEntry?: string | null;
	rscEntry?: string | null;
	router: {
		mode: "server" | "client";
	};
}) => {
	let _serverModules: Set<string>;
	let _clientModules: Set<string>;
	let _clientDeps: Record<string, string[]>;

	return {
		userConfig: {} as UserConfig,
		configEnv: {} as ConfigEnv,
		reactServerWorker: null as null | Awaited<
			ReturnType<typeof createComponentServerWorker>
		>,
		vite: null as null | ResolvedConfig,
		bootstrap(config: UserConfig, env: ConfigEnv) {
			this.userConfig = config;
			this.configEnv = env;
		},
		async configureDevServer(
			server: ViteDevServer & {
				routesManifest?: RouteManifest;
				rscWorker?: Awaited<ReturnType<typeof createComponentServerWorker>>;
			},
		) {
			server.routesManifest = this.routesManifest;
			if (!this.isReactServerWorker) {
				this.reactServerWorker = await createComponentServerWorker("", () => {
					server.ws.send("reload-rsc", { msg: "hello" });
				});
				server.rscWorker = this.reactServerWorker;

				process.on("beforeExit", () => {
					this.close();
				});
			}
		},
		close() {
			if (this.reactServerWorker) {
				this.reactServerWorker.close();
			}
		},
		configResolved(config: ResolvedConfig & { serverComponents?: any }) {
			this.vite = config;
			if (this.isReactServerBuild && config.serverComponents) {
				_serverModules = config.serverComponents.serverModules;
				_clientModules = config.serverComponents.clientModules;
			}
		},

		clientModuleForServer(src: string) {
			return Array.from(Object.entries(this.clientDeps))
				.filter(([k, v]) => v.includes(src))
				.map(([k, v]) => k);
		},

		generateRouteTypes() {
			const env = {
				manifests: {
					routesManifest: this.routesManifest,
				},
				lazyComponent() {
					return null;
				},
			} as unknown as Context;
			const routes = createNestedPageRoutes(
				env,
				"root",
				undefined,
				this.routerMode,
			);

			prettyPrintRoutes(routes, 2);

			generateTypes(
				routes,
				this.absoluteAppRoot,
				this.typescriptAppRoot,
				env.manifests!.routesManifest,
			);
		},
		get root() {
			return this.userConfig.root ?? process.cwd();
		},
		get routerMode() {
			return router.mode;
		},
		get isClientRouting() {
			return this.routerMode === "client";
		},
		get isServerRouting() {
			return this.routerMode === "server";
		},
		get isServerBuild() {
			return this.configEnv.ssrBuild ?? false;
		},
		get isReactServerBuild() {
			return this.isReactServerWorker && this.isServerBuild;
		},
		get isAppServerBuild() {
			return !this.isReactServerWorker && this.isServerBuild;
		},
		get isClientBuild() {
			return this.configEnv.command === "build" && !this.isServerBuild;
		},
		get clientOutDir() {
			return join("dist", "static");
		},
		get appServerOutDir() {
			return join("dist", "server");
		},
		get reactServerOutDir() {
			return join("dist", "react-server");
		},
		get routesDir() {
			return ".";
		},
		get appRoot() {
			return "app";
		},
		get appRootEntry() {
			return "root.tsx";
		},
		get typescriptAppRoot() {
			return ".vite/app";
		},
		get fullyReactPkgDir() {
			return join(_dirname, "..");
		},
		get isReactServerWorker() {
			return Boolean(process.env.COMPONENT_SERVER_WORKER?.length);
		},
		get needsReactServer() {
			return this.isServerRouting;
		},
		appServerEntry: "",
		get routesManifest() {
			if (existsSync(this.absoluteRoutesDir)) {
				// generate route manifest and types
				return defineFileSystemRoutes(this.absoluteRoutesDir);
			}
			return {};
		},
		get pageRoutes(): { [key: string]: ConfigPageRoute } {
			return Object.fromEntries(
				Object.entries(this.routesManifest).filter(([k, v]) => {
					return v.type === "page";
				}),
			) as any;
		},
		get absoluteAppRoot() {
			return join(this.root, this.appRoot);
		},
		get absoluteClientOutDir() {
			return join(this.root, this.clientOutDir);
		},
		get absoluteServerOutDir() {
			return join(this.root, this.appServerOutDir);
		},
		get absoluteReactServerOutDir() {
			return join(this.root, this.reactServerOutDir);
		},
		get absoluteRoutesDir() {
			return join(this.root, this.appRoot, this.routesDir);
		},
		get absoluteTypescriptAppRoot() {
			// TODO: make it work for the actual app directory specified by the user: appRoot
			return this.absoluteAppRoot.replace(/\/app$/, this.typescriptAppRoot);
		},
		get absoluteAppRootEntry() {
			return (
				findAny(this.absoluteAppRoot, "root") ??
				join(this.fullyReactPkgDir, "src", "root.tsx")
			);
		},
		get clientModuleIds() {
			return Array.from(this.clientModules.values());
		},
		set clientDeps(v: Record<string, string[]>) {
			_clientDeps = v;
		},
		get clientEntry() {
			return (
				clientEntry ??
				findAny(this.absoluteAppRoot, "entry-client") ??
				join(this.fullyReactPkgDir, "src", "entry-client.tsx")
			);
		},
		get reactServerEntry() {
			return (
				rscEntry ??
				findAny(this.absoluteAppRoot, "entry-rsc") ??
				join(this.fullyReactPkgDir, "src", "component-server", "entry.tsx")
			);
		},
		get clientDeps() {
			if (_clientDeps) {
				return _clientDeps;
			}
			if (
				existsSync(join(this.absoluteReactServerOutDir, "client-deps.json"))
			) {
				_clientDeps = JSON.parse(
					readFileSync(
						join(this.absoluteReactServerOutDir, "client-deps.json"),
						{
							encoding: "utf8",
						},
					),
				);
			}

			return _clientDeps;
		},
		get clientModules() {
			if (_clientModules) {
				return _clientModules;
			}
			let clientModules: string[] = [];
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

			_clientModules = new Set(clientModules);

			return _clientModules;
		},
		get serverModules() {
			if (_serverModules) {
				return _serverModules;
			}

			let serverModules: string[] = [];
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

			_serverModules = new Set(serverModules);

			return _serverModules;
		},
	};
};

export type ReactEnv = ReturnType<typeof createBundlerEnv>;

export function fullyReactBuild({
	clientEntry,
	rscEntry,
	router,
}: {
	clientEntry?: string | null;
	rscEntry?: string | null;
	router: {
		mode: "server" | "client";
	};
}) {
	const reactEnv = createBundlerEnv({ clientEntry, rscEntry, router });
	return {
		enforce: "pre",
		name: "fully-react",
		async configureServer(
			server: ViteDevServer & {
				routesManifest?: RouteManifest;
				rscWorker?: Awaited<ReturnType<typeof createComponentServerWorker>>;
			},
		) {
			reactEnv.configureDevServer(server);
		},
		closeWatcher() {
			reactEnv.close();
		},
		configResolved(config) {
			reactEnv.configResolved(config);
		},
		// transform(code, id, options) {
		// 	const isSSR = options?.ssr;
		// 	function replaceDynamicImport(code: string) {
		// 		const dynamicImportRegex =
		// 			/(dynamic\()(\(\) => )import\((.*?)\)([\s\S]*?)(, \{[\s\S]*?ssr:\s*false[\s\S]*?\}\))/g;

		// 		return code.replace(
		// 			dynamicImportRegex,
		// 			(_, before, __, importArg, importTransform, after) => {
		// 				const dummyError =
		// 					'() => { throw new Error("No dynamic import"); }';
		// 				return before + dummyError + after;
		// 			},
		// 		);
		// 	}

		// 	return isSSR ? replaceDynamicImport(code) : undefined;
		// },
		config(config, env) {
			reactEnv.bootstrap(config, env);
			reactEnv.generateRouteTypes();

			config.build ||= {};

			if (reactEnv.isReactServerBuild) {
				config.build.rollupOptions ||= {};
				config.build.rollupOptions.input = {};

				config.build.manifest = true;

				config.build.rollupOptions.input["react-server"] =
					reactEnv.reactServerEntry;
				config.build.rollupOptions.input["root"] =
					reactEnv.absoluteAppRootEntry;

				if (reactEnv.routesManifest) {
					Object.entries(reactEnv.routesManifest).forEach(([name, route]) => {
						let chunkName = name.replaceAll(":", "_").replaceAll("/", "_");
						chunkName = chunkName.length > 0 ? chunkName : "root-layout";
						invariant(
							typeof config.build!.rollupOptions!.input === "object" &&
								!Array.isArray(config.build!.rollupOptions!.input),
							"rollupOptions.input must be defined",
						);
						config.build!.rollupOptions!.input[chunkName] = route.file;
					});
				}

				config.build.outDir ||= reactEnv.reactServerOutDir;
				config.build.ssrEmitAssets = true;
				reactEnv.clientDeps = {};
				config.build.rollupOptions.output = {
					manualChunks: function (id, { getModuleInfo }) {
						if (reactEnv.clientModules.has(id)) {
							const dependentEntryPoints = [];

							// we use a Set here so we handle each module at most once. This
							// prevents infinite loops in case of circular dependencies
							const idsToHandle = new Set(getModuleInfo(id)!.importers);

							for (const moduleId of idsToHandle) {
								const { isEntry, dynamicImporters, importers } =
									getModuleInfo(moduleId)!;
								if (
									isEntry ||
									importers.length > 0 ||
									dynamicImporters.length > 0
								)
									dependentEntryPoints.push(moduleId);

								// The Set iterator is intelligent enough to iterate over
								// elements that are added during iteration
								for (const importerId of importers) idsToHandle.add(importerId);
								for (const importerId of dynamicImporters)
									idsToHandle.add(importerId);
							}

							reactEnv.clientDeps[id] = Array.from(
								dependentEntryPoints.values(),
							);
						}
					},
				};
			} else if (reactEnv.isAppServerBuild) {
				config.build.rollupOptions ||= {};
				config.build.target = "esnext";
				config.build.rollupOptions.input ||= {
					handler: "virtual:entry-server",
					index: "virtual:entry-node",
					vercel: "virtual:entry-vercel",
				};

				if (reactEnv.isClientRouting) {
					// @ts-ignore
					config.build.rollupOptions.input["root"] =
						reactEnv.absoluteAppRootEntry;
					if (reactEnv.routesManifest) {
						Object.entries(reactEnv.routesManifest).forEach(([name, route]) => {
							let chunkName = name.replaceAll(":", "_").replaceAll("/", "_");
							chunkName = chunkName.length > 0 ? chunkName : "root-layout";
							invariant(
								typeof config.build!.rollupOptions!.input === "object" &&
									!Array.isArray(config.build!.rollupOptions!.input),
								"rollupOptions.input must be defined",
							);
							config.build!.rollupOptions!.input[chunkName] = route.file;
						});
					}
				}
				config.build.outDir ||= reactEnv.appServerOutDir;
				config.build.ssrEmitAssets = true;
				config.build.manifest = true;
			} else if (reactEnv.isClientBuild) {
				config.build.outDir ||= reactEnv.clientOutDir;
				config.build.ssrManifest = true;
				config.build.rollupOptions ||= {};
				config.build.target = "esnext";
				config.build.rollupOptions.treeshake = true;
				config.build.rollupOptions.preserveEntrySignatures = "exports-only";
				// config.build.rollupOptions.input ||= [reactEnv.clientEntry];
				config.build.manifest = true;

				// TODO: figure out how to make this work
				// config.build.rollupOptions.treeshake = true;
				config.build.rollupOptions.preserveEntrySignatures = "exports-only";
				config.build.rollupOptions.input ||= [];
				// config.build.manifest = true;
				config.build.rollupOptions.output ||= {};
				if (!Array.isArray(config.build.rollupOptions.output)) {
					config.build.minify = !(process.env.MINIFY === "false");
					// config.build.rollupOptions.output.inlineDynamicImports = false;
					config.build.rollupOptions.output.manualChunks = {
						react: [
							"react",
							"react-dom",
							"react/jsx-runtime",
							"react-server-dom-webpack/client.browser",
						],
					};
					config.build.rollupOptions.output.inlineDynamicImports = false;
				}
			}

			return {
				react: reactEnv,
				resolve: {
					alias: {
						"~": reactEnv.absoluteAppRoot,
					},
					conditions: reactEnv.isReactServerWorker
						? ["node", "import", "react-server", "production"]
						: [],
				},
				define: {
					"import.meta.env.CLIENT_ENTRY": JSON.stringify(reactEnv.clientEntry),
					"import.meta.env.ROOT_DIR": JSON.stringify(reactEnv.root),
					"import.meta.env.REACT_SERVER_PROD_ENTRY": JSON.stringify(
						"dist/server/react-server/react-server.js",
					),
					"process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV),
					"import.meta.env.APP_ROOT_ENTRY": JSON.stringify(
						reactEnv.absoluteAppRootEntry,
					),
					"import.meta.env.ROUTER_MODE": JSON.stringify(reactEnv.routerMode),
				},
				ssr: {
					noExternal: ["fully-react", "react-error-boundary"],
				},
			};
		},
		async buildStart(options) {
			if (reactEnv.isAppServerBuild) {
				if (reactEnv.needsReactServer) {
					reactEnv.reactServerWorker = await createComponentServerWorker(
						"",
						() => {
							throw new Error("RSC Worker should not reload while building");
						},
					);
					await reactEnv.reactServerWorker!.build();
					reactEnv.reactServerWorker!.close();

					// the server build will tell us what modules are used
					options.input = {
						...options.input,
						...Object.fromEntries([
							...[...reactEnv.clientModules.values()].map((m) => [
								path.basename(m),
								m,
							]),
							...[...reactEnv.serverModules.values()].map((m) => [
								path.basename(m),
								m,
							]),
						]),
					};
				}
			} else if (reactEnv.isClientBuild) {
				invariant(
					Array.isArray(options.input),
					"options.input must be an array",
				);
				// options.input.push(...reactEnv.clientModules);
				options.input.push("react:routes");
			}
		},
		resolveId(id) {
			if (id.startsWith("react:")) {
				return "\0" + id;
			}
		},
		load(id) {
			const routerPath = join(
				reactEnv.fullyReactPkgDir,
				"src",
				"web",
				"router.ts",
			);

			const rootPath = join(reactEnv.fullyReactPkgDir, "src", "root.tsx");
			if (id === routerPath) {
				return `export * from './${reactEnv.routerMode}-router'`;
			} else if (id === rootPath) {
				return `export { default } from './${reactEnv.routerMode}-root'`;
			}
			if (id === "\0" + "react:route-manifest") {
				if (
					reactEnv.isAppServerBuild ||
					reactEnv.configEnv.command === "serve"
				) {
					return `export default ${JSON.stringify(reactEnv.routesManifest)}`;
				} else if (reactEnv.isClientBuild) {
					const code = `export default ${JSON.stringify(
						reactEnv.pageRoutes,
						(k, v) => {
							if (k === "file") {
								return `_$() => import('${v}')$_`;
							}
							return v;
						},
					)}`;
					return code.replaceAll('"_$(', "(").replaceAll(')$_"', ")");
				} else if (reactEnv.isReactServerBuild) {
					return `export default ${JSON.stringify(reactEnv.routesManifest)}`;
				}
			}
			if (id === "\0" + "react:routes") {
				if (reactEnv.isServerRouting) {
					return `
					let mount = () => import('${reactEnv.clientEntry}'); console.log(mount);
					${reactEnv
						.clientModuleForServer(reactEnv.absoluteAppRootEntry)!
						.map(
							(mod, index) =>
								`let clientComponent${index} =  () => import('${mod}'); console.log(clientComponent${index})`,
						)
						.join(";")}
					${Object.entries(reactEnv.routesManifest)
						.map(
							([k, v], index) =>
								`let route${index} = () => import('${v.file}?route'); console.log(route${index})`,
						)
						.join(";")}
				`;
				} else {
					return `
					let mount = () => import('${reactEnv.clientEntry}'); console.log(mount);
					let mount2 = () => import('${
						reactEnv.absoluteAppRootEntry
					}'); console.log(mount2);
					${Object.entries(reactEnv.routesManifest)
						.filter(([k, v]) => v.type === "page")
						.map(
							([k, v], index) =>
								`let route${index} = () => import('${v.file}'); console.log(route${index})`,
						)
						.join(";")}
				`;
				}
			} else if (id.endsWith("?route")) {
				return `
					${reactEnv
						.clientModuleForServer(id.replace("?route", ""))!
						.map(
							(mod, index) =>
								`let x${index} =  () => import('${mod}'); console.log(x${index})`,
						)
						.join(";")}`;
			}
		},
		async buildEnd() {
			reactEnv.close();
		},
		closeBundle: {
			order: "post",
			handler() {
				if (reactEnv.isClientBuild) {
					// client build goes last and copies the manifest back to the server
					cpSync(
						join(reactEnv.absoluteClientOutDir, "manifest.json"),
						join(reactEnv.absoluteServerOutDir, "static-manifest.json"),
					);

					cpSync(
						join(reactEnv.absoluteClientOutDir, "ssr-manifest.json"),
						join(reactEnv.absoluteServerOutDir, "static-ssr-manifest.json"),
					);
				}
			},
		},
		generateBundle(options) {
			if (reactEnv.isReactServerBuild) {
				logger.info("generating route manifest");
				writeFileSync(
					join(reactEnv.absoluteReactServerOutDir, "client-deps.json"),
					JSON.stringify(reactEnv.clientDeps, null, 2),
				);
			} else if (reactEnv.isAppServerBuild) {
				writeFileSync(
					join(reactEnv.absoluteServerOutDir, "routes.json"),
					JSON.stringify(reactEnv.routesManifest, null, 2),
				);

				if (reactEnv.needsReactServer) {
					logger.info("copying react server to inside app server");
					cpSync(
						reactEnv.absoluteReactServerOutDir,
						join(reactEnv.absoluteServerOutDir, "react-server"),
						{
							recursive: true,
						},
					);
				}
			} else if (reactEnv.isClientBuild) {
				logger.info("copying server assets to client");
				if (existsSync(join(reactEnv.absoluteServerOutDir, "assets"))) {
					cpSync(
						join(reactEnv.absoluteServerOutDir, "assets"),
						join(reactEnv.absoluteClientOutDir, "assets"),
						{
							recursive: true,
							filter: (src) => !src.endsWith(".js"),
						},
					);
				}

				logger.info("copying react server components assets to client");
				if (existsSync(join(reactEnv.absoluteReactServerOutDir, "assets"))) {
					cpSync(
						join(reactEnv.absoluteReactServerOutDir, "assets"),
						join(reactEnv.absoluteClientOutDir, "assets"),

						{
							recursive: true,
							filter: (src) => !src.endsWith(".js"),
						},
					);
				}
			}
		},
	} satisfies Plugin;
}
