import { Thenable, use, useMemo } from "react";
import {
	createFromFetch as createElementFromFetch,
	createFromReadableStream as createElementFromStream,
} from "react-server-dom-webpack/client.edge";
import invariant from "tiny-invariant";

export function encodeText(input: string) {
	return new TextEncoder().encode(input);
}
export function decodeText(
	input: Uint8Array | undefined,
	textDecoder: TextDecoder,
) {
	return textDecoder.decode(input, { stream: true });
}

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

		const read = () => {
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
		};
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

function createResponseFromStream(stream: ReadableStream) {
	return { body: stream } as Response;
}
/**
 *
 * @param src
 * @param props
 */

// async function fetchServerComponent<Props extends any = any>(
// 	src: string,
// 	props: Props,
// ) {
// 	const stream = import.meta.app.fetch(src, props);

// 	if ("then" in stream) {
// 		return stream.then(
// 			(stream) => createResponseFromStream(stream) as Response,
// 		);
// 	}

// 	return createResponseFromStream(stream) as Response;
// }
/**
 * Create a component that renders the Flight stream.
 * This is only used for renderToHTML, the Flight response does not need additional wrappers.
 */
export function createServerComponentRenderer<Props extends any = any>(
	request: Request,
	{
		dataStream: writable,
	}: {
		dataStream: WritableStream;
	},
): (props: Props) => JSX.Element {
	const flightResponseRef: FlightResponseRef = { current: null };

	return function ServerComponentWrapper(props: Props): JSX.Element {
		const response = useMemo(() => {
			if (flightResponseRef.current) {
				return flightResponseRef.current;
			}

			const rscRequest = new Request(request.url, {
				method: "GET",
				headers: {
					"x-renderer": "rsc",
					accept: "text/x-component",
				},
			});

			flightResponseRef.current = createElementFromFetch(
				import.meta.app.fetch(rscRequest, new URL(rscRequest.url)).then((r) => {
					invariant(r.body, "Response body is missing");
					const [renderStream, forwardStream] = r.body.tee();

					// We only attach CSS chunks to the inlined data.
					const forwardReader = forwardStream.getReader();
					const writer = writable.getWriter();

					function read() {
						forwardReader.read().then(({ done, value }) => {
							if (value) {
								// onChunk(value);
							}

							if (done) {
								// flightResponseRef.current = null;
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

			return flightResponseRef.current;
		}, []);

		if (!props) {
			console.log("called with no props");
			throw new Error("");
		}

		return use(response);
	};
}
