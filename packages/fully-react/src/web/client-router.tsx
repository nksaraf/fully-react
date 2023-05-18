import FSRouter from "../app-router/fs";
import { createRouter } from "../app-router/client/router/app-router-client";
import routeManifest from "react:route-manifest";
import { ClientContext } from "./context";

const context = new ClientContext();
const Router = createRouter(context.pageRoutes());

const url = new URL(window.location.href);
export function AppRouter() {
	return (
		<Router
			url={url.href}
			headers={{}}
			params={{}}
			searchParams={Object.fromEntries(url.searchParams.entries())}
		/>
	);
}
