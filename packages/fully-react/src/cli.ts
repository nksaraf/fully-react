import { Manifest, ResolvedConfig, resolveConfig } from "vite";
import { cpSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { removeDir, writeJson } from "./build/fs";

import { RouteManifest } from "./fs-router/types";
import { copyDependenciesToFunction } from "./build/vercel/nft";
import { defineFileSystemRoutes } from "./fs-router";
import { execa } from "execa";
import { getRedirects } from "./build/vercel/redirects";
import { pathToFileURL } from "node:url";
import sade from "sade";
import supportsColor from "supports-color";
import type { ReactEnv } from "./dev-server/fully-react";
import invariant from "tiny-invariant";

async function adapt() {
	const buildTempFolder = pathToFileURL(process.cwd() + "/");
	const outDir = new URL(".vercel/output/", buildTempFolder);
	const serverEntry = new URL("dist/server/vercel.js", buildTempFolder);
	const functionFolder = new URL(
		".vercel/output/functions/render.func/",
		buildTempFolder,
	);

	const config = (await resolveConfig({}, "build")) as ResolvedConfig & {
		react: ReactEnv;
	};

	const staticOutDir = new URL("static", outDir);
	const staticInDir = new URL("dist/static", buildTempFolder);
	// const inc = includeFiles?.map((file) => new URL(file, _config.root)) || [];
	// if (_config.vite.assetsInclude) {
	// 	const mergeGlobbedIncludes = (globPattern: unknown) => {
	// 		if (typeof globPattern === "string") {
	// 			const entries = glob.sync(globPattern).map((p) => pathToFileURL(p));
	// 			inc.push(...entries);
	// 		} else if (Array.isArray(globPattern)) {
	// 			for (const pattern of globPattern) {
	// 				mergeGlobbedIncludes(pattern);
	// 			}
	// 		}
	// 	};

	// 	mergeGlobbedIncludes(_config.vite.assetsInclude);
	// }

	const serverManifest: Manifest = JSON.parse(
		readFileSync("dist/server/manifest.json", "utf-8"),
	);

	const entries: URL[] = [];

	if (config.react.needsReactServer) {
		const serverClientManifest: string[] = JSON.parse(
			readFileSync("dist/server/react-server/client-manifest.json", "utf-8"),
		);
		const serverServerManifest: string[] = JSON.parse(
			readFileSync("dist/server/react-server/server-manifest.json", "utf-8"),
		);

		serverServerManifest.forEach((s) => {
			entries.push(
				new URL(
					`./` + serverManifest[relative(process.cwd(), s)].file,
					serverEntry,
				),
			);
		});

		serverClientManifest.forEach((s) => {
			entries.push(
				new URL(
					`./` + serverManifest[relative(process.cwd(), s)].file,
					serverEntry,
				),
			);
		});
	}

	// Remove previous output folder
	await removeDir(outDir);

	cpSync(staticInDir, staticOutDir, { recursive: true });

	const routeChunks: string[] = [];
	if (config.react.routesManifest) {
		Object.entries(config.react.routesManifest).forEach(([name, route]) => {
			let chunkName = name.replaceAll(":", "_").replaceAll("/", "_");
			chunkName = chunkName.length > 0 ? chunkName : "root-layout";
			routeChunks.push(chunkName);
		});
	}

	// Copy necessary files (e.g. node_modules/)
	const { handler } = await copyDependenciesToFunction({
		entries: [
			serverEntry,
			new URL("dist/server/root.js", buildTempFolder),
			...routeChunks.map(
				(chunk) => new URL(`dist/server/${chunk}.js`, buildTempFolder),
			),
			...(config.react.needsReactServer
				? [
						new URL(
							"dist/server/react-server/react-server.js",
							buildTempFolder,
						),
						...entries,
				  ]
				: []),
		],
		outDir: functionFolder,
		// includeFiles: inc,
		includeFiles: [],
		excludeFiles: [],
		// excludeFiles:
		// 	excludeFiles?.map((file) => new URL(file, _config.root)) || [],
	});

	const root = handler.replace("dist/server/vercel.js", "");

	// Enable ESM
	// https://aws.amazon.com/blogs/compute/using-node-js-es-modules-and-top-level-await-in-aws-lambda/
	await writeJson(new URL(`package.json`, functionFolder), {
		type: "module",
	});

	// Serverless function config
	// https://vercel.com/docs/build-output-api/v3#vercel-primitives/serverless-functions/configuration
	await writeJson(new URL(`.vc-config.json`, functionFolder), {
		runtime: getRuntime(),
		handler,
		environment: {
			OUT_ROOT_DIR: root,
		},
		launcherType: "Nodejs",
	});

	await writeJson(
		new URL(root + "dist/server/static-manifest.json", functionFolder),
		JSON.parse(readFileSync("dist/static/manifest.json", "utf-8")),
	);

	await writeJson(
		new URL(root + "dist/server/static-ssr-manifest.json", functionFolder),
		JSON.parse(readFileSync("dist/static/ssr-manifest.json", "utf-8")),
	);

	await writeJson(
		new URL(root + "dist/server/routes.json", functionFolder),
		JSON.parse(readFileSync("dist/server/routes.json", "utf-8")),
	);

	await writeJson(
		new URL(root + "dist/server/manifest.json", functionFolder),
		JSON.parse(readFileSync("dist/server/manifest.json", "utf-8")),
	);

	// Output configuration
	// https://vercel.com/docs/build-output-api/v3#build-output-configuration
	await writeJson(new URL(`config.json`, outDir), {
		version: 3,
		routes: [
			// ...getRedirects(routes, _config),
			{ handle: "filesystem" },
			{ src: "/.*", dest: "render" },
		],
	});
}

function getRuntime() {
	const version = process.version.slice(1); // 'v16.5.0' --> '16.5.0'
	const major = version.split(".")[0]; // '16.5.0' --> '16'
	return `nodejs${major}.x`;
}

async function generate() {
	const config = await resolveConfig(
		{
			build: {
				ssr: true,
			},
		},
		"build",
	);
	const env = (config as any).react as ReactEnv;
	const handlerPath = join(process.cwd(), "/dist/server/handler.js");
	const staticOutDir = join(process.cwd(), "/dist/static");
	const { default: handler } = await import(handlerPath);

	const getUrl = (url: string) => {
		if (url === "") {
			return "index.html";
		}

		return url.endsWith("/")
			? `${url.slice(1)}index.html`
			: `${url.slice(1)}.html`;
	};

	const urls = Object.values(env.pageRoutes)
		.filter((e) => e.path?.endsWith("/") || e.index)
		.map((e) => e.path?.slice(0, e.path?.length - 1) ?? "/");

	for await (const url of urls) {
		const html = await (
			await handler({
				request: new Request("https://example.com" + url),
			})
		).text();

		writeFileSync(join(staticOutDir, getUrl(url)), html);
	}

	for await (const url of urls) {
		if (env.routerMode === "server") {
			const html = await (
				await handler({
					request: new Request("https://example.com" + url + ".rsc", {
						headers: {
							accept: "text/x-component",
						},
					}),
				})
			).text();

			writeFileSync(
				join(staticOutDir, getUrl(url).replace(".html", ".rsc")),
				html,
			);
		}
	}
}

// generate();

const react = sade("react-server");

react
	.command("dev")
	.describe("Start the development server")
	.action(async () => {
		console.log("Starting development server...");

		execa("vite", ["dev"], {
			stdio: "inherit",
			shell: true,
			env: { ...process.env, FORCE_COLOR: "true" },
		});
	});

react
	.command("adapt")
	.describe("Adapt the server to the environment")
	.action(async () => {
		adapt();
	});

react
	.command("generate")
	.describe("Adapt the server to the environment")
	.action(async () => {
		await generate();
	});

react
	.command("build")
	.describe("Build")
	.action(async () => {
		const serverBuild = await execa("vite", ["build", "--ssr"], {
			stdio: "inherit",
			shell: true,
			env: { ...process.env, FORCE_COLOR: "true" },
		});

		await execa("vite", ["build"], {
			stdio: "inherit",
			shell: true,
			env: { ...process.env, FORCE_COLOR: "true" },
		});

		await generate();
	});

react.parse(process.argv);
