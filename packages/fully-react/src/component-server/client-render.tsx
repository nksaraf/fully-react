import type { App } from "../vite-app-router/App";

function renderServerComponentDev<T extends any = any>(
	src: string,
	props: T,
	env: App,
): Promise<ReadableStream> | ReadableStream {
	env.webServer.context.debug.router("rendering server component", src);
	return env.bundler.reactServerWorker.renderToReadableStream(src, props);
}

async function renderServerComponentProd<T extends any = any>(
	src: string,
	props: T,
	env: App,
): Promise<ReadableStream> {
	const path = await import("node:path");
	const rootDir = path.join(process.cwd(), process.env.OUT_ROOT_DIR ?? ".");
	const { default: entry } = await import(
		/* @vite-ignore */ path.join(
			rootDir,
			import.meta.env.REACT_SERVER_PROD_ENTRY,
		)
	);
	const stream = await entry(src, props, env);
	return stream;
}

export const renderServerComponent = import.meta.env.DEV
	? renderServerComponentDev
	: renderServerComponentProd;
