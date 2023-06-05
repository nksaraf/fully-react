import { decodeReply } from "react-server-dom-webpack/server.edge";

import { AppContext } from "../app-context/context";
import { createHTMLResponse } from "../react/html/html";
import { getURLFromRedirectError, isRedirectError } from "../shared/redirect";
import { createActionResponse } from "./action";
import { requestAsyncContext } from "./async-context";
import { createServerComponentResponse } from "./server-components";

export async function handleActionRequest(
	request: Request,
	context: AppContext,
) {
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
		data = await decodeReply(encodedArgs);
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
