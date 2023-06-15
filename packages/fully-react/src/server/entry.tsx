import { HattipHandler } from "@hattip/core";

import { getApp } from "../app";
// import { AppDevContext } from "../app-context/AppDevContext";
// import { AppProdContext } from "../app-context/AppProdContext";
// import viteDevServer from "../dev-server";
import { FetchEvent } from "./event";

// const createAppContext = import.meta.env.PROD
// 	? () => new AppProdContext()
// 	: () => new AppDevContext(viteDevServer, "app");

export function createHandler() {
	const app = getApp();
app.bundler.viteServer?.moduleGraph

	const handler: HattipHandler = ({
		request,
		ip,
		passThrough,
		waitUntil,
		platform,
	}) =>
		app.webServer.handleEvent(
			new FetchEvent(request, {
				ip,
				passThrough,
				waitUntil,
				platform,
			}),
		);

	return handler;
}
