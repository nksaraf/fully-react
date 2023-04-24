import { createLogger, ViteDevServer, type Plugin } from "vite";
import path, { dirname, join } from "node:path";
import { cpSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { defineFileSystemRoutes } from "../fs-router";
import { generateTypes, prettyPrintRoutes } from "../fs-router/dev";
import { createNestedPageRoutes } from "../fs-router/nested";
import { Env, RouteManifest } from "../server/env";
import { createRSCWorker as createReactServerWorker } from "../react-server/node-worker-client";
import invariant from "tiny-invariant";
import { fileURLToPath } from "node:url";

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

export function fullyReactBuild({
	clientEntry,
	rscEntry,
}: {
	clientEntry?: string | null;
	rscEntry?: string | null;
}) {
	const reactEnv = {
		isClientBuild: false,
		isAppServerBuild: false,
		isServerBuild: false,
		isReactServerWorker: false,
		isReactServerBuild: false,
		clientOutDir: "",
		appServerOutDir: "",
		reactServerOutDir: "",
		routesDir: "",
		appRoot: "",
		appRootEntry: "",
		root: "",
		typescriptAppRoot: ".vite/app",
		clientEntry: "",
		reactServerEntry: "",
		appServerEntry: "",
		fullyReactPkgDir: "",
		routesManifest: {} as RouteManifest,
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
			return join(this.absoluteAppRoot, this.appRootEntry);
		},
		get clientModules() {
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

			return clientModules;
		},
		get serverModules() {
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

			return serverModules;
		},
	};

	let reactServerWorker: Awaited<ReturnType<typeof createReactServerWorker>>;
	return {
		name: "fully-react",
		async configureServer(
			server: ViteDevServer & {
				routesManifest?: RouteManifest;
				rscWorker?: Awaited<ReturnType<typeof createReactServerWorker>>;
			},
		) {
			server.routesManifest = reactEnv.routesManifest;
			if (!reactEnv.isReactServerWorker) {
				reactServerWorker = await createReactServerWorker("", () => {
					server.ws.send("reload-rsc", { msg: "hello" });
				});
				server.rscWorker = reactServerWorker;

				process.on("beforeExit", () => {
					reactServerWorker.close();
				});
			}
		},
		closeWatcher() {
			if (reactServerWorker) {
				reactServerWorker.close();
			}
		},
		config(config, env) {
			reactEnv.root = config.root ?? process.cwd();
			reactEnv.isReactServerWorker = Boolean(process.env.RSC_WORKER?.length);
			reactEnv.isServerBuild = env.ssrBuild ?? false;
			reactEnv.isReactServerBuild =
				reactEnv.isReactServerWorker && reactEnv.isServerBuild;
			reactEnv.isAppServerBuild =
				!reactEnv.isReactServerWorker && reactEnv.isServerBuild;
			reactEnv.isClientBuild =
				env.command === "build" && !reactEnv.isServerBuild;

			reactEnv.clientOutDir = join("dist", "static");
			reactEnv.appServerOutDir = join("dist", "server");
			reactEnv.reactServerOutDir = join("dist", "react-server");

			reactEnv.routesDir = "routes";
			reactEnv.appRoot = "app";
			reactEnv.appRootEntry = "root";
			reactEnv.typescriptAppRoot = ".vite/app";
			reactEnv.fullyReactPkgDir = join(_dirname, "..");

			// reactEnv.appRootEntry =
			// 	rscEntry ??
			// 	findAny(reactEnv.absoluteAppRoot, "entry-rsc") ??
			// 	join(reactEnv.fullyReactPkgDir, "dist", "entry-rsc.production.js");

			reactEnv.clientEntry =
				clientEntry ??
				findAny(reactEnv.absoluteAppRoot, "entry-client") ??
				join(reactEnv.fullyReactPkgDir, "src", "entry-client.tsx");

			reactEnv.reactServerEntry =
				rscEntry ??
				findAny(reactEnv.absoluteAppRoot, "entry-rsc") ??
				join(reactEnv.fullyReactPkgDir, "dist", "entry-rsc.production.js");

			if (existsSync(reactEnv.absoluteRoutesDir)) {
				// generate route manifest and types
				reactEnv.routesManifest = defineFileSystemRoutes(
					reactEnv.absoluteRoutesDir,
				);

				generateRouteTypes();
			}

			config.build ||= {};

			if (reactEnv.isReactServerBuild) {
				config.build.rollupOptions ||= {};
				config.build.rollupOptions.input = {};

				config.build.manifest = true;

				console.log(reactEnv.absoluteAppRootEntry);
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
				console.log(config.build.rollupOptions);
			} else if (reactEnv.isAppServerBuild) {
				if (config.build.ssr === true) {
					config.build.rollupOptions ||= {};
					config.build.rollupOptions.input ||= {
						handler: "/virtual:vavite-connect-handler",
						index: "/virtual:vavite-connect-server",
					};
				}
				config.build.outDir ||= reactEnv.appServerOutDir;
				config.build.ssrEmitAssets = true;
				config.build.manifest = true;
			} else if (reactEnv.isClientBuild) {
				config.build.outDir ||= reactEnv.clientOutDir;
				config.build.ssrManifest = true;
				config.build.rollupOptions ||= {};
				config.build.rollupOptions.treeshake = false;
				config.build.rollupOptions.preserveEntrySignatures = "exports-only";
				config.build.rollupOptions.input ||= [reactEnv.clientEntry];
				config.build.manifest = true;
			}

			return {
				react: reactEnv,
				resolve: {
					alias: {
						"~": path.resolve(reactEnv.root, "app"),
						"~react/entry-client": reactEnv.clientEntry,
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
				},
				ssr: {
					noExternal: ["fully-react", "react-error-boundary"],
				},
			};
		},
		async buildStart(options) {
			if (reactEnv.isAppServerBuild) {
				reactServerWorker = await createReactServerWorker("", () => {
					throw new Error("RSC Worker should not reload while building");
				});
				await reactServerWorker.build();

				// the server build will tell us what modules are used
				options.input = {
					...options.input,
					...Object.fromEntries([
						...reactEnv.clientModules.map((m) => [path.basename(m), m]),
						...reactEnv.serverModules.map((m) => [path.basename(m), m]),
					]),
				};
			} else if (reactEnv.isClientBuild) {
				invariant(
					Array.isArray(options.input),
					"options.input must be an array",
				);
				options.input.push(...reactEnv.clientModules);
			}
		},
		async buildEnd() {
			if (reactEnv.isAppServerBuild) {
				reactServerWorker.close();
			}
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
				}
			},
		},
		generateBundle(options) {
			if (reactEnv.isReactServerBuild) {
				logger.info("generating route manifest");
				writeFileSync(
					join(reactEnv.absoluteReactServerOutDir, "routes.json"),
					JSON.stringify(reactEnv.routesManifest, null, 2),
				);
			} else if (reactEnv.isAppServerBuild) {
				logger.info("copying react server to inside app server");
				cpSync(
					reactEnv.absoluteReactServerOutDir,
					join(reactEnv.absoluteServerOutDir, "react-server"),
					{
						recursive: true,
					},
				);
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

	function generateRouteTypes() {
		const env = {
			manifests: {
				routesManifest: reactEnv.routesManifest,
			},
			lazyComponent() {
				return null;
			},
		} as unknown as Env;
		const routes = createNestedPageRoutes(env, "root");

		prettyPrintRoutes(routes, 2);

		generateTypes(
			routes,
			reactEnv.absoluteAppRoot,
			reactEnv.typescriptAppRoot,
			env.manifests!.routesManifest,
		);
	}
}
