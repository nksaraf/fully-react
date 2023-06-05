/// <reference types="node" />
import invariant from "tiny-invariant";
import { build, createServer } from "vite";

import { AsyncLocalStorage } from "node:async_hooks";
import { existsSync, readFileSync } from "node:fs";
import { builtinModules } from "node:module";
import { join } from "node:path";
import { parentPort } from "node:worker_threads";

import { getApp } from "../app/index.js";

// @ts-ignore
global.AsyncLocalStorage = AsyncLocalStorage;

export class ComponentServer {
	/**
	 *
	 * @param {string} component
	 * @param {any} props
	 * @returns {Promise<ReadableStream>}
	 */
	async renderToReadablStream(component, props) {
		throw new Error("Not implemented");
	}
}

/**
 *
 * @param {ReadableStream} stream
 * @param {(message: string) => void} onMessage
 */
function streamToMessageChannel(stream, onMessage) {
	const forwardReader = stream.getReader();

	const textDecoder = new TextDecoder();

	function read() {
		forwardReader.read().then(({ done, value }) => {
			if (done) {
				onMessage("end");
			} else {
				onMessage(textDecoder.decode(value));
				read();
			}
		});
	}
	read();
}

class ComponentDevServer extends ComponentServer {
	/** @type {import('vite').ViteDevServer | null} */
	devServer;

	/** @type {import('node:worker_threads').MessagePort} */
	port;

	constructor(/** @type {import('node:worker_threads').MessagePort} */ port) {
		super();
		this.port = port;
		this.devServer = null;
	}

	async createDevServer() {
		if (!this.devServer) {
			this.devServer = await createServer({
				optimizeDeps: {
					// It's recommended to disable deps optimization
					disabled: true,
				},
				plugins: [
					{
						name: "vite-app-router-hmr",
						handleHotUpdate(ctx) {
							parentPort?.postMessage(JSON.stringify({ type: "reload" }));
						},
					},
				],
			});

			// this is need to initialize the plugins
			await this.devServer.pluginContainer.buildStart({});
		}

		return this.devServer;
	}

	async handleMessage(/** @type {string} */ msg) {
		const event = JSON.parse(msg);

		if (event.type === "render") {
			try {
				const stream = await this.renderToReadableStream(
					event.component,
					event.props,
				);

				streamToMessageChannel(stream, (msg) => {
					parentPort?.postMessage(JSON.stringify({ chunk: msg, id: event.id }));
				});
			} catch (e) {
				console.error(e);
			}
		} else if (event.type === "build") {
			const buildResult = await this.build();
			parentPort?.postMessage(
				JSON.stringify({
					id: event.id,
					status: "built",
					...buildResult,
				}),
			);
		}
	}

	async build() {
		await build({
			build: {
				ssr: true,
				target: "node18",
				manifest: true,
				ssrManifest: true,
				minify: !(process.env.MINIFY === "false"),
				rollupOptions: {
					treeshake: true,
					external: [
						"node:path",
						"node:fs",
						"node:async_hooks",
						"node:url",
						"@prisma/client",
						"@auth/core",
						"fs",
						"path",
						"url",
						...builtinModules,
					],
				},
			},
			resolve: {
				conditions: ["node", "import", "react-server", "production"],
			},
			ssr: {
				noExternal: true,
			},
		});
		const root = process.cwd();

		/** @type {string[]} */
		let clientModules = [];

		/** @type {string[]} */
		let serverModules = [];

		if (
			existsSync(join(root, "dist", "react-server", "client-manifest.json"))
		) {
			clientModules = JSON.parse(
				readFileSync(
					join(root, "dist", "react-server", "client-manifest.json"),
					{
						encoding: "utf8",
					},
				),
			);
		}

		if (
			existsSync(join(root, "dist", "react-server", "server-manifest.json"))
		) {
			serverModules = JSON.parse(
				readFileSync(
					join(root, "dist", "react-server", "server-manifest.json"),
					{
						encoding: "utf8",
					},
				),
			);
		}

		return {
			clientModules,
			serverModules,
			root,
		};
	}

	listen() {
		this.port.addListener("message", this.handleMessage.bind(this));
		this.port.postMessage("ready");
	}

	async getApp() {
		if (!this.devServer) {
			await this.createDevServer();
		}
		return getApp();
	}
	/**
	 *
	 * @param {string} component
	 * @param {any} props
	 * @returns {Promise<ReadableStream>}
	 */
	async renderToReadableStream(component, props) {
		const app = await this.getApp();
		return app.fetchServerComponent(component, props);
	}
}

invariant(parentPort, "parentPort is not defined");
const componentServer = new ComponentDevServer(parentPort);
componentServer.listen();
