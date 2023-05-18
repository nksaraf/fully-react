import { type Plugin, type PluginOption } from "vite";
import inspect from "vite-plugin-inspect";
import tsconfigPaths from "vite-tsconfig-paths";
import reactRefresh from "@vitejs/plugin-react";
import { serverComponents } from "./dev-server/server-components";
import { exposeDevServer } from "./dev-server/vite-dev-server";
import { fullyReactBuild } from "./dev-server/fully-react";
import connect from "./winterkit/connect";

import { createRequire } from "node:module";

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
		exposeDevServer(),
		connect(),
		serverComponents(),
	];
}

export default react;
