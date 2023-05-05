export function request() {
	return globalThis.requestAsyncContext.getStore()!.request;
}

export function headers() {
	return globalThis.requestAsyncContext.getStore()!.request.headers;
}

export function response() {
	return globalThis.requestAsyncContext.getStore()!.internal.response;
}

export function measurer() {
	return globalThis.requestAsyncContext.getStore()!.internal.measurer;
}
