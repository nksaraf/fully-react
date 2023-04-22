import { ReadableStream } from "node:stream/web";
import { Worker } from "node:worker_threads";
import { require } from "..";

// TODO: Use something other than JSON for worker communication.
/**
 * Create a worker thread that will be used to render RSC chunks.
 * @param buildPath Absolute path to the the built RSC bundle.
 */

export async function createRSCWorker(buildPath: string, onReload: () => void) {
	const rscWorker = require.resolve("./rsc-worker");
	const worker = new Worker(rscWorker, {
		execArgv: ["--conditions", "react-server"],
		env: {
			RSC_WORKER: "true",
			// DEBUG: "vite:*",
			NODE_ENV: process.env.NODE_ENV ?? "production",
			MINIFY: process.argv.includes("--minify") ? "true" : "false",
		},
		workerData: {
			buildPath,
		},
	});

	await new Promise<void>((resolve, reject) =>
		worker.once("message", (event) => {
			if (event === "ready") {
				resolve();
			} else {
				reject(new Error("rsc worker failed to start"));
			}
		}),
	);
	const responses = new Map<string, (event: any) => void>();
	const encoder = new TextEncoder();
	worker.on("message", (msg) => {
		const { id, ...event } = JSON.parse(msg);
		if (event.type === "reload") {
			onReload();
			return;
		}

		const res = responses.get(id)!;
		res(event);
	});

	worker.once("exit", (code) => {
		console.log("RSC worker exited with code", code);
		process.exit(code);
	});

	return {
		render(component: string, props: any) {
			const id = Math.random() + "";
			worker.postMessage(
				JSON.stringify({
					component,
					props,
					type: "render",
					id,
				}),
			);

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
		},
		build: () => {
			return new Promise((resolve) => {
				const id = Math.random() + "";
				responses.set(id, ({ status }) => {
					if (status === "built") {
						resolve("");
					}
				});
				worker.postMessage(
					JSON.stringify({
						type: "build",
						id,
					}),
				);
			});
		},
		close: () => {
			worker.unref();
		},
	};
}
