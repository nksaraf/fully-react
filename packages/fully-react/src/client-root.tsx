"use client";
import { createRouter } from "./app-router/client/router/app-router-client";
import { ServerContext } from "./server/ServerContext";

function createClientRouter(context: ServerContext) {
	const Router = createRouter(context.pageRoutes());
	return Router;
}

export default createClientRouter(context);
