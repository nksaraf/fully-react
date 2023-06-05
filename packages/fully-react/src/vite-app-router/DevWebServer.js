import { compose } from "@hattip/compose";
import invariant from "ts-invariant";

import { Router } from "../app-context/Router";
import { defineFileSystemRoutes } from "../fs-router";
import { handlePageRequest } from "../server/handlePageRequest";
import { handleServerComponentRequest } from "../server/handleServerComponentRequest";

/** @typedef {{ name?: string, matcher: (request: Request, url: URL) => boolean, handler: (request: Request, url: URL) => Promise<Response>}} Handler */

export class DevWebServer {
	/**
	 * @type {Handler[]}
	 */
	handlers = [
		{
			name: "server component",
			matcher: (request, url) => {
				return (
					request.headers.get("accept")?.includes("text/x-component") ?? false
				);
			},
			handler: async (request, url) => {
				return new Response("Hello world from server component server");
			},
		},
		{
			name: "html",
			matcher: (request, url) => {
				return request.headers.get("x-renderer")?.includes("html") ?? false;
			},
			async handler(request, url) {
				await import.meta.app.initializeRenderer();

				return await import.meta.app.renderer.fetch(request, url);
			},
		},
		{
			name: "app-router",
			matcher: (request, url) => {
				return request.headers.get("accept")?.includes("text/html") ?? false;
			},
			async handler(request, url) {
				let htmlURL = new URL(import.meta.env.APP_ROOT_ENTRY, import.meta.url);
				url.searchParams.forEach(([key, value]) => {
					htmlURL.searchParams.set(key, value);
				});

				let htmlRequest = new Request(htmlURL, {
					method: "GET",
					headers: {
						...Object.fromEntries(request.headers.entries()),
						"x-renderer": "html",
					},
				});

				return await requestAsyncContext.run(
					{ request, internal: {} },
					async () => await import.meta.app.fetch(htmlRequest, url),
				);
			},
		},
	];

	/** @type {import('@hattip/compose').RequestHandler[]} */
	_middleware = [];

	/** @type {import('../server/event').FetchHandler | null} */
	_handler = null;

	/** @type {import('./App.js').App} */
	_app;

	/**
	 *
	 * @param {import('./App.js').App} app
	 */
	constructor(app) {
		this._app = app;

		this.router = new Router(
			defineFileSystemRoutes(app.bundler.absoluteRoutesDir),
			app.moduleLoader,
		);
		// this.context = new AppDevContext(this.app, "");

		// this.context.setup();
		this.use(async (event) => {
			return await this.fetch(event.request, event.url);
		});
	}

	prepareError(url, e) {
		return {
			message: `An error occured while server rendering ${url}:\n\n\t${
				typeof e === "string" ? e : e.message
			} `,
			stack: typeof e === "string" ? "" : e.stack,
		};
	}

	errorPage(url, error) {
		this.fixStacktrace(error);
		return new Response(
			`
				<!DOCTYPE html>
				<html lang="en">
					<head>
						<meta charset="UTF-8" />
						<title>Error</title>
						<script type="module">
							import { ErrorOverlay } from '/@vite/client'
							document.body.appendChild(new ErrorOverlay(${JSON.stringify(
								this.prepareError(url, error),
							).replace(/</g, "\\u003c")}))
						</script>
					</head>
					<body>
					</body>
				</html>
			`,
			{
				status: 500,
				headers: {
					"Content-Type": "text/html",
				},
			},
		);
	}

	/**
	 *
	 * @param {Request} src
	 * @param {URL} url
	 * @returns
	 */
	async fetch(src, url) {
		let handler = this.handlers.find((handler) => {
			return handler.matcher(src, url);
		});

		if (!handler) {
			import.meta.app.debug.router("error", "Not found", url.href);
			return this.errorPage(url, new Error("Not found"));
		}

		this.app.debug.router(`handling with ${handler.name}`, url.href);
		return await handler.handler(src, url);
	}

	// /**
	//  *
	//  * @param {import('../server/event').FetchEvent} event
	//  * @returns
	//  */
	// handleFetchEvent(event) {
	// 	if (event.method === "GET") {
	// 		if (event.request.headers.get("accept")?.includes("text/x-component")) {
	// 			return this.renderServerComponent(event.request);
	// 		}
	// 		return this.renderPage(event.request);
	// 	}
	// 	return new Response("Hello world");
	// }

	// /**
	//  *
	//  * @param {Request} request
	//  */
	// async renderPage(request) {
	// 	const url = new URL(request.url);

	// 	let htmlURL = new URL(import.meta.env.APP_ROOT_ENTRY, import.meta.url);
	// 	url.searchParams.forEach(([key, value]) => {
	// 		htmlURL.searchParams.set(key, value);
	// 	});

	// 	let htmlRequest = new Request(htmlURL, {
	// 		method: "GET",
	// 		headers: Object.fromEntries(request.headers.entries()),
	// 	});

	// 	return await requestAsyncContext.run(
	// 		{ request, internal: {} },
	// 		async () => await this.app.fetch(htmlRequest),
	// 	);
	// }

	// /**
	//  * @param {Request} request
	//  */
	// renderServerComponent(request) {
	// 	return handleServerComponentRequest(request, getApp());
	// }

	/**
	 *
	 * @param {import('../server/event').FetchHandler} handler
	 */
	use(handler) {
		// @ts-expect-error - handler is not a RequestHandler
		this._middleware.push(handler);
		this._handler = compose(this._middleware);
	}

	/**
	 *
	 * @param {import('../server/event').FetchEvent} event
	 * @returns {import('@hattip/compose').MaybeAsyncResponse}
	 */
	handleEvent(event) {
		if (event.type === "fetch") {
			invariant(this._handler, "No handler created");
			return this._handler(event);
		}

		throw new Error("Unknown event type");
	}

	fixStacktrace(/** @type {Error} */ err) {
		invariant(this._app.bundler.viteServer, "No vite server");
		err.stack = err.stack?.replaceAll("/@fs/", "/");
		this._app.bundler.viteServer.ssrFixStacktrace(err);
	}

	get app() {
		invariant(this._app, "No app");
		return this._app;
	}

	/**
	 *
	 * @param {import('http').IncomingMessage} req
	 * @param {import('http').ServerResponse} res
	 */
	async handleNodeRequest(req, res) {
		/**
		 * @param {number} status
		 * @param {string} message
		 */
		function renderError(status, message) {
			res.statusCode = status;
			res.end(message);
		}
		try {
			const module = await this.app.moduleLoader.load("virtual:entry-dev");
			await module.default(req, res, () => {
				if (!res.writableEnded) renderError(404, "Not found");
			});
		} catch (err) {
			if (err instanceof Error) {
				this.fixStacktrace(err);
				renderError(500, err.stack || err.message);
			} else {
				renderError(500, "Unknown error");
			}
		}
	}
}
