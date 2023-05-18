import React, { Thenable, use, useCallback, useMemo } from "react";
import {
	createFromFetch as createElementFromFetch,
	createFromReadableStream as createElementFromStream,
} from "react-server-dom-webpack/client.edge";

import type { Context } from "./context";
import { ReactRefreshScript } from "./dev";
import {
	RenderToReadableStreamOptions,
	renderToReadableStream as _renderToHTMLStream,
	renderToReadableStream,
	renderToString,
} from "react-dom/server.edge";
import { renderServerComponent } from "../component-server/render";
import { sanitize } from "./htmlescape";
import { isNotFoundError, isRedirectError } from "../shared/navigation";
import { isNoSSRError } from "../client/dynamic/no-ssr-error";
import { ServerInsertedHTMLContext } from "./server-inserted-html";

function encodeText(input: string) {
	return new TextEncoder().encode(input);
}

function decodeText(input: Uint8Array | undefined, textDecoder: TextDecoder) {
	return textDecoder.decode(input, { stream: true });
}

const queueTask =
	process.env.NEXT_RUNTIME === "edge" ? globalThis.setTimeout : setImmediate;

type FlightResponseRef = {
	current: null | Thenable<JSX.Element>;
};
/**
 * Render Flight stream.
 * This is only used for renderToHTML, the Flight response does not need additional wrappers.
 */

function useServerElement(
	serverElementStream: ReadableStream<Uint8Array>,
	flightResponseRef: FlightResponseRef,
	writable?: WritableStream<Uint8Array>,
	onChunk: (chunk: Uint8Array) => void = () => {},
) {
	if (flightResponseRef.current !== null) {
		return flightResponseRef.current;
	}

	if (writable && !writable.locked) {
		const [renderStream, forwardStream] = serverElementStream.tee();
		const res = createElementFromStream(renderStream, {
			callServer: (method, args) => {
				throw new Error("Not implemented");
			},
			// moduleMap: isEdgeRuntime
			// 	? clientReferenceManifest.edgeSSRModuleMapping
			// 	: clientReferenceManifest.ssrModuleMapping,
		});

		flightResponseRef.current = res;

		// We only attach CSS chunks to the inlined data.
		const forwardReader = forwardStream.getReader();
		const writer = writable.getWriter();

		function read() {
			forwardReader.read().then(({ done, value }) => {
				if (value) {
					onChunk(value);
				}

				if (done) {
					flightResponseRef.current = null;
					writer.close();
				} else {
					writer.write(value);
					read();
				}
			});
		}
		read();

		return res;
	} else {
		return createElementFromStream(serverElementStream, {
			callServer: (method, args) => {
				throw new Error("Not implemented");
			},
			// moduleMap: isEdgeRuntime
			// 	? clientReferenceManifest.edgeSSRModuleMapping
			// 	: clientReferenceManifest.ssrModuleMapping,
		});
	}
}

/**
 * Create a component that renders the Flight stream.
 * This is only used for renderToHTML, the Flight response does not need additional wrappers.
 */

function createServerComponentRenderer<Props extends any = any>(
	src: string,
	{
		dataStream: writable,
	}: {
		dataStream: WritableStream;
	},
	context: Context,
): (props: Props) => JSX.Element {
	const flightResponseRef: FlightResponseRef = { current: null };

	return function ServerComponentWrapper(props: Props): JSX.Element {
		const response = useMemo(() => {
			if (!writable || writable.locked) {
				return createElementFromFetch(
					renderServerComponent(src, props, context).then(
						(r) => ({ body: r } as Response),
					),
					{
						callServer: (method, args) => {
							throw new Error("Not implemented");
						},
					},
				);
			}

			const res = createElementFromFetch(
				renderServerComponent(src, props, context).then((r) => {
					const [renderStream, forwardStream] = r.tee();

					// We only attach CSS chunks to the inlined data.
					const forwardReader = forwardStream.getReader();
					const writer = writable.getWriter();

					function read() {
						forwardReader.read().then(({ done, value }) => {
							if (value) {
								// onChunk(value);
							}

							if (done) {
								flightResponseRef.current = null;
								writer.close();
							} else {
								writer.write(value);
								read();
							}
						});
					}
					read();
					return { body: renderStream } as Response;
				}),
				{
					callServer: (method, args) => {
						throw new Error("Not implemented");
					},
				},
			);

			flightResponseRef.current = res;
			return res;
		}, [writable]);

		if (!props) {
			console.log("called with no props");
			throw new Error("");
		}

		return use(response);
	};
}

/**
 * Renders a React element to a ReadableStream of HTML. It first renders the
 * element to a ReadableStream of RSC, and then uses the RSC stream to render
 * the HTML stream. It then inlines the RSC stream as data in script tags at
 * the end of the HTML stream.
 *
 * When the RSC stream is rendered to HTML, it also renders the Client
 * components which were skipped during the RSC render.
 *
 * @param element React element to render, should be server component
 * @param renderOptions
 * @returns ReadableStream of HTML
 */

async function renderServerComponentToHTMLStream(
	component: string,
	props: any,
	options: {
		dataStream: WritableStream;
	} & RenderToReadableStreamOptions,
	context: Context,
) {
	const ServerComponent = createServerComponentRenderer(
		component,
		{
			dataStream: options.dataStream,
		},
		context,
	);

	const htmlStream = await _renderToHTMLStream(
		<ServerComponent {...props} />,
		options,
	);

	return htmlStream.pipeThrough(bufferedTransformStream());
}

function errorHandler(error: any) {
	if (isNotFoundError(error) || isRedirectError(error) || isNoSSRError(error)) {
		return error.digest;
	}

	console.log(error);
}

async function streamToString(
	stream: ReadableStream<Uint8Array>,
): Promise<string> {
	const reader = stream.getReader();
	const textDecoder = new TextDecoder();

	let bufferedString = "";

	while (true) {
		const { done, value } = await reader.read();

		if (done) {
			return bufferedString;
		}

		bufferedString += decodeText(value, textDecoder);
	}
}

export async function createHTMLResponse(
	component: string,
	props: any,
	context: Context,
	responseInit: ResponseInit = {},
) {
	const transformStream = new TransformStream();
	try {
		if (import.meta.env.ROUTER_MODE === "server") {
			const htmlStream = (
				await renderServerComponentToHTMLStream(
					component,
					props,
					{
						bootstrapModules: context.bootstrapModules(),
						bootstrapScriptContent: context.bootstrapScriptContent(),
						onError: errorHandler,
						dataStream: transformStream.writable,
					},
					context,
				)
			).pipeThrough(inlineInitialServerComponent(transformStream.readable));

			return new Response(htmlStream, {
				...responseInit,
				headers: {
					"Content-Type": "text/html",
					...(responseInit.headers ?? {}),
				},
			});
		} else {
			const { default: Component } = await context.loadModule(component);

			const polyfillsFlushed = false;
			const flushedErrorMetaTagsUntilIndex = 0;
			const serverInsertedHTMLCallbacks: Set<() => React.ReactNode> = new Set();
			const InsertedHTML = function InsertedHTML({
				children,
			}: {
				children: JSX.Element;
			}) {
				// Reset addInsertedHtmlCallback on each render
				const addInsertedHtml = useCallback(
					(handler: () => React.ReactNode) => {
						console.log("adding stuff", handler);
						serverInsertedHTMLCallbacks.add(handler);
					},
					[],
				);

				console.log({ addInsertedHtml });

				return (
					<ServerInsertedHTMLContext.Provider value={addInsertedHtml}>
						{children}
					</ServerInsertedHTMLContext.Provider>
				);
			};

			const htmlStream = await _renderToHTMLStream(
				<InsertedHTML>
					<Component {...props} />
				</InsertedHTML>,
				{
					bootstrapModules: context.bootstrapModules(),
					bootstrapScriptContent: context.bootstrapScriptContent(),
					onError: errorHandler,
				},
			);

			const getServerInsertedHTML = async () => {
				// Loop through all the errors that have been captured but not yet
				// flushed.
				// const errorMetaTags = [];
				// for (
				// 	;
				// 	flushedErrorMetaTagsUntilIndex < allCapturedErrors.length;
				// 	flushedErrorMetaTagsUntilIndex++
				// ) {
				// 	const error = allCapturedErrors[flushedErrorMetaTagsUntilIndex];
				// 	if (isNotFoundError(error)) {
				// 		errorMetaTags.push(
				// 			<meta name="robots" content="noindex" key={error.digest} />,
				// 		);
				// 	} else if (isRedirectError(error)) {
				// 		const redirectUrl = getURLFromRedirectError(error);
				// 		if (redirectUrl) {
				// 			errorMetaTags.push(
				// 				<meta
				// 					httpEquiv="refresh"
				// 					content={`0;url=${redirectUrl}`}
				// 					key={error.digest}
				// 				/>,
				// 			);
				// 		}
				// 	}
				// }

				const stream = await renderToReadableStream(
					<>
						{Array.from(serverInsertedHTMLCallbacks).map((callback) =>
							callback(),
						)}
						{/* {errorMetaTags} */}
					</>,
				);

				await stream.allReady;
				const text = await streamToString(stream);
				console.log(text);
				return text;
				// polyfillsFlushed = true;
				// return flushed;
			};

			return new Response(
				htmlStream.pipeThrough(bufferedTransformStream()).pipeThrough(
					createHeadInsertionTransformStream(async () => {
						// TODO-APP: Insert server side html to end of head in app layout rendering, to avoid
						// hydration errors. Remove this once it's ready to be handled by react itself.
						const serverInsertedHTML = getServerInsertedHTML
							? await getServerInsertedHTML()
							: "";
						return serverInsertedHTML;
					}),
				),
				{
					...responseInit,
					headers: {
						"Content-Type": "text/html",
						...(responseInit.headers ?? {}),
					},
				},
			);
		}
	} catch (e: unknown) {
		const htmlStream = await _renderToHTMLStream(
			<html id="__error__">
				<head>
					<meta name="error-message" content={(e as Error).message} />
					<ReactRefreshScript />
				</head>
				<body></body>
			</html>,
			{
				bootstrapModules: context.bootstrapModules(),
				bootstrapScriptContent: context.bootstrapScriptContent(),
				onError: errorHandler,
			},
		);
		console.log({ error: e });
		return new Response(
			htmlStream
				.pipeThrough(bufferedTransformStream())
				.pipeThrough(inlineInitialServerComponent(transformStream.readable)),
			{
				headers: { "Content-Type": "text/html" },
			},
		);
	}
}

async function nextMacroTask(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

const closingBodyHtmlText = /*#__PURE__*/ `</body></html>`;
/**
 * Creates a TransformStream that inlines the initial RSC stream that is used * produce the HTML stream, as data in script tags at the end of the HTML
 * stream. Note that the RSC stream should be teed before being passed to this
 * function, so that the HTML stream can be read from the first tee, and the
 * RSC stream can be read from the second tee for inlining.
 *
 * It inlines it right before the closing body tag, so that the RSC stream
 * doesn't have to be parsed/processed by the browser until after the HTML
 * stream has been parsed.
 *
 * The API it exposes on the client is:
 * - window.init_rsc: a ReadableStream that is the initial RSC stream,
 * 							  			should be used for hydration
 * - window.rsc_chunk(chunk): a function that can be used to write chunks to
 * 										 the RSC stream, which will be inlined in the HTML stream
 * @param serverElementStream
 * @returns TransformStream
 */

function inlineInitialServerComponent(
	serverElementStream: ReadableStream<Uint8Array>,
): ReadableWritablePair<Uint8Array, Uint8Array> {
	let removedClosingBodyHtmlText = false;
	let insertingServerElementStreamScripts: Promise<void> | undefined;
	let finishedInsertingServerElementStreamScripts = false;

	const textDecoder = new TextDecoder();
	const textEncoder = new TextEncoder();

	return new TransformStream<Uint8Array, Uint8Array>({
		transform(chunk, controller) {
			const text = textDecoder.decode(chunk);

			if (
				text.endsWith(closingBodyHtmlText) &&
				!finishedInsertingServerElementStreamScripts
			) {
				const [withoutClosingBodyHtmlText] = text.split(closingBodyHtmlText);

				controller.enqueue(textEncoder.encode(withoutClosingBodyHtmlText));

				removedClosingBodyHtmlText = true;
			} else {
				controller.enqueue(chunk);
			}

			if (!insertingServerElementStreamScripts) {
				const reader = serverElementStream.getReader();

				controller.enqueue(
					textEncoder.encode(
						`<script>(()=>{const{writable,readable}=new TransformStream();const writer=writable.getWriter();self.init_server=readable;self.chunk=(text)=>writer.write(new TextEncoder().encode(text))})()</script>`,
					),
				);

				insertingServerElementStreamScripts = new Promise(async (resolve) => {
					try {
						while (true) {
							const result = await reader.read();

							if (result.done) {
								finishedInsertingServerElementStreamScripts = true;

								if (removedClosingBodyHtmlText) {
									controller.enqueue(textEncoder.encode(closingBodyHtmlText));
								}

								return resolve();
							}

							await nextMacroTask();

							controller.enqueue(
								textEncoder.encode(
									`<script>self.chunk(${sanitize(
										JSON.stringify(textDecoder.decode(result.value)),
									)});</script>`,
								),
							);
						}
					} catch (error) {
						controller.error(error);
					}
				});
			}
		},

		async flush() {
			return insertingServerElementStreamScripts;
		},
	});
}

function createHeadInsertionTransformStream(
	insert: () => Promise<string>,
): TransformStream<Uint8Array, Uint8Array> {
	let inserted = false;
	let freezing = false;
	const textDecoder = new TextDecoder();

	return new TransformStream({
		async transform(chunk, controller) {
			// While react is flushing chunks, we don't apply insertions
			if (freezing) {
				controller.enqueue(chunk);
				return;
			}

			const insertion = await insert();
			if (inserted) {
				controller.enqueue(encodeText(insertion));
				controller.enqueue(chunk);
				freezing = true;
			} else {
				const content = decodeText(chunk, textDecoder);
				const index = content.indexOf("</head>");
				if (index !== -1) {
					const insertedHeadContent =
						content.slice(0, index) + insertion + content.slice(index);
					controller.enqueue(encodeText(insertedHeadContent));
					freezing = true;
					inserted = true;
				}
			}

			if (!inserted) {
				controller.enqueue(chunk);
			} else {
				queueTask(() => {
					freezing = false;
				});
			}
		},
		async flush(controller) {
			// Check before closing if there's anything remaining to insert.
			const insertion = await insert();
			if (insertion) {
				controller.enqueue(encodeText(insertion));
			}
		},
	});
}

/**
 * Creates a TransformStream that inlines the initial RSC stream that is used * produce the HTML stream, as data in script tags at the end of the HTML
 * stream. Note that the RSC stream should be teed before being passed to this
 * function, so that the HTML stream can be read from the first tee, and the
 * RSC stream can be read from the second tee for inlining.
 *
 * It inlines it right before the closing body tag, so that the RSC stream
 * doesn't have to be parsed/processed by the browser until after the HTML
 * stream has been parsed.
 *
 * The API it exposes on the client is:
 * - window.init_rsc: a ReadableStream that is the initial RSC stream,
 * 							  			should be used for hydration
 * - window.rsc_chunk(chunk): a function that can be used to write chunks to
 * 										 the RSC stream, which will be inlined in the HTML stream
 * @param serverElementStream
 * @returns TransformStream
 */
// function initialDataServerStream(
// 	// serverElementStream: ReadableStream<Uint8Array>,
// 	getData: () => any,
// ): ReadableWritablePair<Uint8Array, Uint8Array> {
// 	const removedClosingBodyHtmlText = false;
// 	let insertingServerElementStreamScripts: Promise<void> | undefined;
// 	const finishedInsertingServerElementStreamScripts = false;

// 	const textDecoder = new TextDecoder();
// 	const textEncoder = new TextEncoder();

// 	return new TransformStream<Uint8Array, Uint8Array>({
// 		transform(chunk, controller) {
// 			// const text = textDecoder.decode(chunk);

// 			// if (
// 			// 	text.endsWith(closingBodyHtmlText) &&
// 			// 	!finishedInsertingServerElementStreamScripts
// 			// ) {
// 			// 	const [withoutClosingBodyHtmlText] = text.split(closingBodyHtmlText);

// 			controller.enqueue(chunk);

// 			// 	removedClosingBodyHtmlText = true;
// 			// } else {
// 			// 	controller.enqueue(chunk);
// 			// }

// 			if (!insertingServerElementStreamScripts) {
// 				// const reader = serverElementStream.getReader();

// 				controller.enqueue(
// 					textEncoder.encode(
// 						`<script>self.init_data=[${JSON.stringify(getData())}]</script>`,
// 					),
// 				);

// 				// insertingServerElementStreamScripts = new Promise(async (resolve) => {
// 				// 	try {
// 				// 		while (true) {
// 				// 			const result = await reader.read();

// 				// 			if (result.done) {
// 				// 				finishedInsertingServerElementStreamScripts = true;

// 				// 				if (removedClosingBodyHtmlText) {
// 				// 					controller.enqueue(textEncoder.encode(closingBodyHtmlText));
// 				// 				}

// 				// 				return resolve();
// 				// 			}

// 				// 			await nextMacroTask();

// 				// 			controller.enqueue(
// 				// 				textEncoder.encode(
// 				// 					`<script>self.chunk(${sanitize(
// 				// 						JSON.stringify(textDecoder.decode(result.value)),
// 				// 					)});</script>`,
// 				// 				),
// 				// 			);
// 				// 		}
// 				// 	} catch (error) {
// 				// 		controller.error(error);
// 				// 	}
// 				// });
// 			}
// 		},

// 		async flush() {
// 			return insertingServerElementStreamScripts;
// 		},
// 	});
// }

/**
 * Creates a TransformStream that buffers the text in the stream, and then
 * flushes it all at once at the end of the stream.
 * @returns TransformStream
 */

function bufferedTransformStream(): ReadableWritablePair<
	Uint8Array,
	Uint8Array
> {
	let bufferedText = ``;
	let buffering: Promise<void> | undefined;

	return new TransformStream({
		transform(chunk, controller) {
			bufferedText += new TextDecoder().decode(chunk);

			buffering ||= new Promise(async (resolve) => {
				await nextMacroTask();

				controller.enqueue(new TextEncoder().encode(bufferedText));

				bufferedText = ``;
				buffering = undefined;

				resolve();
			});
		},

		async flush() {
			return buffering;
		},
	});
}
