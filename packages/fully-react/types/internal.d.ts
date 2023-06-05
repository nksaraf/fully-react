export { RouteManifest } from "../src/fs-router/types";

export type ComponentServer = {
	renderToReadableStream: (src: string, props: any) => Promise<ReadableStream>;
};

interface App {}

interface ServerApp {
	handleFetch: (request: Request) => Promise<Response>;
}
