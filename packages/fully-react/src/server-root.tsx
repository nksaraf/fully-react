// import { getApp } from "./app";
// import { createRouter } from "./app-router/server";
// import { App } from "./vite-app-router/App";
import routeManifest from "app:react-routes";

import { createNestedPageRoutes } from "./fs-router/nested";
import { ReactRefreshScript } from "./react/html/dev";

// function createServerRouter(context: App) {
// 	const Router = createRouter(context.webServer.router.pageRoutes());
// 	return Router;
// }

// export default createServerRouter(getApp());

export default function Hello() {
	return (
		<html>
			<head>
				<title>Hello</title>
				<script type="module" src="/@vite/client"></script>
				<ReactRefreshScript />
			</head>
			<body>
				<div>Loading...</div>
			</body>
		</html>
	);
}
