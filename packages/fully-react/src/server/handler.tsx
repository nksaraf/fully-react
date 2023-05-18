import { Router, createRouter } from "@hattip/router";
import { getURLFromRedirectError, isRedirectError } from "../shared/redirect";

import { Context } from "./context";
import { createActionResponse } from "./action";
import { createHTMLResponse } from "./html";
import { createServerComponentResponse } from "./server-components";
import {
	decodeAction,
	decodeServerFunctionArgs,
} from "../component-server/stream";
import { requestAsyncContext } from "./async-context";
import { Measurer } from "../measurer";
import { decodeReply } from "react-server-dom-webpack/server.edge";

export async function handleActionRequest(request: Request, context: Context) {
	const actionId = request.headers.get("x-action")!;
	const isAction = !!actionId;
	const isForm =
		request.headers.get("content-type") === "application/x-www-form-urlencoded";
	const isMultiPartForm = request.headers
		.get("content-type")
		?.startsWith("multipart/form-data");

	if (!isAction && !isForm && !isMultiPartForm) {
		return new Response("Not Found", { status: 404 });
	}

	let data: any;
	if (isForm || isMultiPartForm) {
		// const formData = await request.formData();
		// console.log(formData);
		const encodedArgs = await request.formData();
		// data = await decodeServerFunctionArgs(encodedArgs, env.clientModuleMap);
		console.log(data);
	} else {
		const encodedArgs = await request.text();
		data = await decodeServerFunctionArgs(encodedArgs);
	}

	const [filePath, name] = actionId.split("#");

	const action = (await context.loadModule(filePath))[name];

	const isMutating = request.headers.get("x-mutation") === "1";

	// if it's a mutation, either plain action, or form, we return a RSC response
	// for the next page the user needs to visit, (could be the same page too)
	if (isMutating) {
		const responseInit: ResponseInit = {};
		return requestAsyncContext.run(
			{ request, internal: { response: responseInit } },
			async () => {
				try {
					await action(...data);
					const url = new URL(request.url);
					return createServerComponentResponse(
						import.meta.env.APP_ROOT_ENTRY,
						{
							url: url.href,
							searchParams: Object.fromEntries(url.searchParams.entries()),
							headers: Object.fromEntries(request.headers.entries()),
							params: {},
						},
						context,
					);
				} catch (e) {
					console.error(e);
					if (isRedirectError(e)) {
						const redirectPath = getURLFromRedirectError(e);
						const url = new URL(redirectPath, request.url);
						return createServerComponentResponse(
							import.meta.env.APP_ROOT_ENTRY,
							{
								url: url.href,
								searchParams: Object.fromEntries(url.searchParams.entries()),
								headers: Object.fromEntries(request.headers.entries()),
								params: {},
							},
							context,
							{
								status: 200,
								headers: {
									"x-redirect": redirectPath,
								},
							},
						);
					}
				}
			},
		);
	} else if (isForm || isMultiPartForm) {
		try {
			await action(...data);
			const url = new URL(request.url);
			const responseInit: ResponseInit = {};
			return requestAsyncContext.run(
				{ request, internal: { response: responseInit } },
				async () => {
					return createHTMLResponse(
						import.meta.env.APP_ROOT_ENTRY,
						{
							url: url.href,
							searchParams: Object.fromEntries(url.searchParams.entries()),
							headers: Object.fromEntries(request.headers.entries()),
							params: {},
						},
						context,
						responseInit,
					);
				},
			);
		} catch (e) {
			if (isRedirectError(e)) {
				return new Response("", {
					status: 302,
					headers: {
						Location: getURLFromRedirectError(e),
					},
				});
			}
		}
	}

	return createActionResponse(action, data, context);
}

export async function handlePageRequest(request: Request, context: Context) {
	const url = new URL(request.url);
	const responseInit: ResponseInit = {};
	const measurer = new Measurer();

	const response = await measurer.time(
		"createHTMLResponse",
		async () =>
			await requestAsyncContext.run(
				{ request, internal: { response: responseInit } },
				async () =>
					await createHTMLResponse(
						import.meta.env.APP_ROOT_ENTRY!,
						{
							url: request.url,
							searchParams: Object.fromEntries(url.searchParams.entries()),
							headers: Object.fromEntries(request.headers.entries()),
							params: {},
						},
						context,
						responseInit,
					),
			),
	);

	console.log(request.url, response.status);
	const headers = new Headers(response.headers);

	(await measurer.toHeaders()).forEach((value, key) => {
		headers.set(key, value);
	});

	return new Response(response.body, {
		headers,
	});
}

export async function handleServerComponentRequest(
	request: Request,
	context: Context,
) {
	const cleanedUrl = request.url.replace(/\.rsc$/, "");
	const url = new URL(request.headers.get("x-navigate") ?? "/", cleanedUrl);
	const currentRouterState = JSON.parse(
		request.headers.get("x-router") ?? "null",
	);
	const response: ResponseInit = {};
	return requestAsyncContext.run({ request, internal: { response } }, () =>
		createServerComponentResponse(
			import.meta.env.APP_ROOT_ENTRY,
			{
				url: cleanedUrl,
				searchParams: Object.fromEntries(url.searchParams.entries()),
				headers: Object.fromEntries(request.headers.entries()),
				params: {},
				currentRouterState,
			},
			context,
			response,
		),
	);
}

export function createRequestRouter(env: Context): Router {
	const router = createRouter();

	Object.entries(env.getRouteHandlers()).forEach(([entry, route]) => {
		// if (route.type === "route") {
		router.get(route.path, async (event) => {
			const mod = await env.loadModule(route.file);

			const handler = mod[event.request.method];
			return await handler(event.request, event.params);
		});

		router.post(route.path, async (event) => {
			const mod = await env.loadModule(route.file);

			const handler = mod[event.request.method];
			return await handler(event.request, event.params);
		});
		// }
	});

	/**
	 * This is the endpoint used by actions and forms. It is used to respond to server functions.
	 */
	router.post("/*", async (event) => {
		return handleActionRequest(event.request, env);
	});

	/**
	 * This handles all the routes defined in the app. It renders HTML by first rendering
	 * the RSC tree and then passing that to react-dom/server's streaming renderer.
	 */
	router.get("/*", async (event) => {
		console.log(event.request.url);
		if (isServerComponentRequest(event.request)) {
			return handleServerComponentRequest(event.request, env);
		}

		return await handlePageRequest(event.request, env);
	});

	return router;
}

function isServerComponentRequest(request: Request) {
	return request.headers.get("accept") === "text/x-component";
}
