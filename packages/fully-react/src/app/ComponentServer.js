import { renderToReadableStream } from "react-server-dom-webpack/server.edge";

import { createModuleMapProxy } from "../app-context/webpack";
import { createErrorHandler } from "../react/html/errorHandler";
import { requestAsyncContext } from "../server/async-context";

export class ComponentServer {
	/**
	 *
	 * @param {Request} request
	 * @param {JSX.Element} element
	 * @returns
	 */
	renderToReadableStream(request, element) {
		return requestAsyncContext.run(
			{
				request,
				internal: { response: {} },
			},
			async () => {
				const stream = renderToReadableStream(element, createModuleMapProxy(), {
					onError: createErrorHandler(),
				});
				// this.debug.router("created stream");
				return stream;
			},
		);
	}
}
