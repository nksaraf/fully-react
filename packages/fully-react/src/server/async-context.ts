import { AsyncLocalStorage } from "node:async_hooks";

import { Measurer } from "../measurer";

interface RequestAsyncContext {
	internal: {
		response?: ResponseInit;
		measurer?: Measurer;
	};
	request: Request;
}

declare global {
	export var requestAsyncContext: AsyncLocalStorage<RequestAsyncContext>;
}

export const requestAsyncContext =
	globalThis.requestAsyncContext ??
	new AsyncLocalStorage<RequestAsyncContext>();

globalThis.requestAsyncContext = requestAsyncContext;
