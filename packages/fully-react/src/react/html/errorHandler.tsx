import { isNoSSRError } from "../../client/dynamic/no-ssr-error";
import { isNotFoundError, isRedirectError } from "../../shared/navigation";

function errorHandler(error: any) {
	if (isNotFoundError(error) || isRedirectError(error) || isNoSSRError(error)) {
		return error.digest;
	}

	import.meta.app.webServer.fixStacktrace(error);
	import.meta.app.debug("error", error);
}

export function createErrorHandler() {
	return errorHandler;
}
