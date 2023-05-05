import { type Plugin, type PluginOption } from "vite";
import inspect from "vite-plugin-inspect";
import tsconfigPaths from "vite-tsconfig-paths";
import reactRefresh from "@vitejs/plugin-react";
import { reactServerComponents } from "./dev-server/server-components";
import { hattip } from "./winterkit/vite-plugin";
import { exposeDevServer } from "./dev-server/vite-dev-server";

function makeDefaultNodeEntry(hattipEntry: string | undefined) {
	if (!hattipEntry) {
		throw new Error("No hattip entry found");
	}

	return `
		import handler from ${JSON.stringify(hattipEntry)};
		import { createMiddleware } from "fully-react/node";
		export default createMiddleware(handler);
	`;
}

import { createRequire } from "node:module";
import { fullyReactBuild } from "./dev-server/fully-react";

export const require = createRequire(import.meta.url);

export function react({
	server = true,
	router = {
		mode: "server" as "server" | "client",
	},
	inspect: _inspect = Boolean(process.env.INSPECT?.length),
	reactRefresh: _reactRefresh = true,
	tsconfigPaths: _tsconfigPaths = true,
	serverEntry = "fully-react/entry-server",
	clientEntry = undefined as string | null | undefined,
	rscEntry = undefined as string | null | undefined,
} = {}): (Plugin | PluginOption[] | PluginOption | undefined)[] {
	return [
		fullyReactBuild({
			clientEntry,
			rscEntry,
			router,
		}),
		_tsconfigPaths ? tsconfigPaths() : undefined,
		_inspect
			? inspect({
					build: true,
			  })
			: undefined,
		_reactRefresh ? reactRefresh() : undefined,
		(server
			? hattip({
					clientConfig: {},
					hattipEntry: serverEntry,
					devEntry: makeDefaultNodeEntry,
					nodeEntry: serverEntry,
			  })
			: exposeDevServer()) as Plugin,
		reactServerComponents(),
	];
}

export default react;
