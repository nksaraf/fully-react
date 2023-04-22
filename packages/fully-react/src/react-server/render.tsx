import type { Env } from "../server/env";

async function renderServerComponentDev<T extends any = any>(
	src: string,
	props: T,
	env: Env,
): Promise<ReadableStream> {
	const { default: devServer } = await import("../dev-server");
	return devServer.rscWorker.render(src, props, env);
}

async function renderServerComponentProd<T extends any = any>(
	src: string,
	props: T,
	env: Env,
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
