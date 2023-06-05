import invariant from "tiny-invariant";

import { createRequire } from "node:module";
import { ReadableStream } from "node:stream/web";
import { Worker } from "node:worker_threads";

const require = createRequire(import.meta.url);

// TODO: Use something other than JSON for worker communication.
/**
 * Create a worker thread that will be used to render RSC chunks.
 * @param {string} buildPath Absolute path to the the built RSC bundle.
 * @param {() => void} onReload Called when the worker reloads.
 */

export class ComponentServerMain {
	/** @type {import('node:worker_threads').Worker | null} */
	worker = null;

	/** @type {Map<string, (event: any) => void>} */
	responses = new Map();

	/**
	 *
	 * @param {string} buildPath
	 * @param {() => void} onReload
	 */
	async init(buildPath, onReload) {
		this.worker = new Worker(require.resolve("./node-worker.js"), {
			execArgv: ["--conditions", "react-server"],
			env: {
				COMPONENT_SERVER_WORKER: "true",
				// DEBUG: "vite:*",
				DEBUG: process.env.DEBUG,
				DEBUG_COLORS: process.env.DEBUG_COLORS,
				NODE_ENV: process.env.NODE_ENV ?? "production",
				MINIFY: process.argv.includes("--minify") ? "true" : "false",
			},
			workerData: {
				buildPath,
			},
		});

		await new Promise((resolve, reject) => {
			invariant(this.worker, "Worker is not initialize");
			this.worker.once("message", (event) => {
				if (event === "ready") {
					resolve(undefined);
				} else {
					reject(new Error("rsc worker failed to start"));
				}
			});
		});

		const encoder = new TextEncoder();
		this.worker.on("message", (msg) => {
			const { id, ...event } = JSON.parse(msg);
			if (event.type === "reload") {
				onReload();
				return;
			}

			const res = this.responses.get(id);
			invariant(res, `No response handler for id ${id}`);
			res(event);
		});

		this.worker.once("exit", (code) => {
			console.log("Component server worker exited with code", code);
			process.exit(code);
		});
	}

	/**
	 *
	 * @param {string} component
	 * @param {any} props
	 * @returns {globalThis.ReadableStream}
	 */
	renderToReadableStream(component, props) {
		invariant(this.worker, "Worker is not initialize");
		const id = Math.random() + "";
		this.worker.postMessage(
			JSON.stringify({
				component,
				props,
				type: "render",
				id,
			}),
		);

		let responses = this.responses;
		let encoder = new TextEncoder();

		return new ReadableStream({
			start(controller) {
				responses.set(id, ({ chunk }) => {
					if (chunk === "end") {
						controller.close();
						responses.delete(id);
						return;
					}

					if (chunk) controller.enqueue(encoder.encode(chunk));
				});
			},
		});
	}

	build() {
		let responses = this.responses;
		return new Promise((resolve) => {
			invariant(this.worker, "Worker is not initialized");
			const id = Math.random() + "";
			responses.set(id, ({ status }) => {
				if (status === "built") {
					resolve("");
				}
			});
			this.worker.postMessage(
				JSON.stringify({
					type: "build",
					id,
				}),
			);
		});
	}
	close() {
		if (this.worker) {
			this.worker.unref();
		}
	}
}

// export async function createComponentServerWorker(buildPath, onReload) {
// 	const worker = new Worker(
// 		require.resolve("../src/component-server/node-worker.js"),
// 		{
// 			execArgv: ["--conditions", "react-server"],
// 			env: {
// 				COMPONENT_SERVER_WORKER: "true",
// 				// DEBUG: "vite:*",
// 				DEBUG: process.env.DEBUG,
// 				DEBUG_COLORS: process.env.DEBUG_COLORS,
// 				NODE_ENV: process.env.NODE_ENV ?? "production",
// 				MINIFY: process.argv.includes("--minify") ? "true" : "false",
// 			},
// 			workerData: {
// 				buildPath,
// 			},
// 		},
// 	);

// 	await new Promise((resolve, reject) =>
// 		worker.once("message", (event) => {
// 			if (event === "ready") {
// 				resolve(undefined);
// 			} else {
// 				reject(new Error("rsc worker failed to start"));
// 			}
// 		}),
// 	);

// 	/** @type {Map<string, (event: any) => void>} */
// 	const responses = new Map();
// 	const encoder = new TextEncoder();
// 	worker.on("message", (msg) => {
// 		const { id, ...event } = JSON.parse(msg);
// 		if (event.type === "reload") {
// 			onReload();
// 			return;
// 		}

// 		const res = responses.get(id);
// 		invariant(res, `No response handler for id ${id}`);
// 		res(event);
// 	});

// 	worker.once("exit", (code) => {
// 		console.log("Component server worker exited with code", code);
// 		process.exit(code);
// 	});

// 	return {
// 		/**
// 		 *
// 		 * @param {string} component
// 		 * @param {any} props
// 		 * @returns {ReadableStream<Uint8Array>}
// 		 */
// 		renderToReadableStream(component, props) {
// 			const id = Math.random() + "";
// 			worker.postMessage(
// 				JSON.stringify({
// 					component,
// 					props,
// 					type: "render",
// 					id,
// 				}),
// 			);

// 			return new ReadableStream({
// 				start(controller) {
// 					responses.set(id, ({ chunk }) => {
// 						if (chunk === "end") {
// 							controller.close();
// 							responses.delete(id);
// 							return;
// 						}

// 						if (chunk) controller.enqueue(encoder.encode(chunk));
// 					});
// 				},
// 			});
// 		},
// 		build: () => {
// 			return new Promise((resolve) => {
// 				const id = Math.random() + "";
// 				responses.set(id, ({ status }) => {
// 					if (status === "built") {
// 						resolve("");
// 					}
// 				});
// 				worker.postMessage(
// 					JSON.stringify({
// 						type: "build",
// 						id,
// 					}),
// 				);
// 			});
// 		},
// 		close: () => {
// 			worker.unref();
// 		},
// 	};
// // }
