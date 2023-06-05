// export function createRequestRouter(env: App): Router {
// 	const router = createRouter();

// 	Object.entries(env.getRouteHandlers()).forEach(([entry, route]) => {
// 		// if (route.type === "route") {
// 		router.get(route.path, async (event) => {
// 			const mod = await env.loadModule(route.file);

// 			const handler = mod[event.request.method];
// 			return await handler(event.request, event.params);
// 		});

// 		router.post(route.path, async (event) => {
// 			const mod = await env.loadModule(route.file);

// 			const handler = mod[event.request.method];
// 			return await handler(event.request, event.params);
// 		});
// 		// }
// 	});

// 	/**
// 	 * This is the endpoint used by actions and forms. It is used to respond to server functions.
// 	 */
// 	router.post("/*", async (event) => {
// 		return handleActionRequest(event.request, env);
// 	});

// 	/**
// 	 * This handles all the routes defined in the app. It renders HTML by first rendering
// 	 * the RSC tree and then passing that to react-dom/server's streaming renderer.
// 	 */
// 	router.get("/*", async (event) => {
// 		env.debug.server("request", event.method, event.request.url);
// 		if (isServerComponentRequest(event.request)) {
// 			return handleServerComponentRequest(event.request, env);
// 		}

// 		return await handlePageRequest(event.request, env);
// 	});

// 	return router;
// }

export function isServerComponentRequest(request: Request) {
	return request.headers.get("accept") === "text/x-component";
}
