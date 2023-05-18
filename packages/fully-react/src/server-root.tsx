import { createRouter } from "./app-router/server";
import { ServerContext } from "./server/ServerContext";

function createServerRouter(context: ServerContext) {
	const Router = createRouter(context.pageRoutes());
	return Router;
}

export default createServerRouter(context);
