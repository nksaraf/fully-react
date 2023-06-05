import { createElement } from "react";
import { renderToReadableStream as _renderToHTMLStream } from "react-dom/server.edge";

import { createErrorHandler } from "./errorHandler";
import { bufferedTransformStream, inlineInitialServerComponent } from "./html";
import { createServerComponentRenderer } from "./server-component";

export class ReactRenderer {
	app;

	/**
	 *
	 * @param {ImportMeta['app']} app
	 */
	constructor(app) {
		this.app = app;
	}

	clientModules() {
		return [`/@fs${import.meta.app.CLIENT_ENTRY}`];
	}

	clientScriptContent() {
		return undefined;
	}

	/**
	 *
	 * @param {Request} src
	 * @param {URL} props
	 * @returns {Promise<Response>}
	 */
	async fetch(src, props) {
		console.log(props);
		try {
			return new Response(await this.renderToHTMLStream(src, props), {
				headers: {
					"Content-Type": "text/html",
				},
			});
		} catch (e) {
			return import.meta.app.webServer.errorPage("/", e);
		}
	}

	/**
	 *
	 * @param {Request} request
	 * @param {any} props
	 */
	async renderToHTMLStream(request, props) {
		if (import.meta.app.ROUTER_MODE === "server") {
			const transformStream = new TransformStream();

			try {
				import.meta.app.debug.router("rendering server component", request.url);
				const ServerComponent = createServerComponentRenderer(request, {
					dataStream: transformStream.writable,
				});

				const htmlStream = await _renderToHTMLStream(
					createElement(ServerComponent, {
						url: request.url,
					}),
					{
						bootstrapModules: this.clientModules(),
						bootstrapScriptContent: this.clientScriptContent(),
						onError: createErrorHandler(),
					},
				);

				return htmlStream
					.pipeThrough(bufferedTransformStream())
					.pipeThrough(inlineInitialServerComponent(transformStream.readable));
			} catch (e) {
				import.meta.app.debug("error", e);
			}
		} else {
			let { default: Component } = await import.meta.app.moduleLoader.load(
				import.meta.app.ROOT_ENTRY,
			);
			return await _renderToHTMLStream(
				createElement(Component, {
					url: props.href,
				}),
				{
					bootstrapModules: this.clientModules(),
					bootstrapScriptContent: this.clientScriptContent(),
					onError: createErrorHandler(),
				},
			);
		}
	}
}
