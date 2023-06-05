export const NOT_FOUND_ERROR_CODE = "NOT_FOUND";

type NotFoundError = Error & { digest: typeof NOT_FOUND_ERROR_CODE };

/**
 * When used in a React server component, this will set the status code to 404.
 * When used in a custom app route it will just send a 404 status.
 */
export function notFound(): never {
	// eslint-disable-next-line no-throw-literal
	const error = new Error(NOT_FOUND_ERROR_CODE);
	(error as NotFoundError).digest = NOT_FOUND_ERROR_CODE;
	throw error;
}

/**
 * Checks an error to determine if it's an error generated by the `notFound()`
 * helper.
 *
 * @param error the error that may reference a not found error
 * @returns true if the error is a not found error
 */
export function isNotFoundError(error: any): error is NotFoundError {
	return error?.digest === NOT_FOUND_ERROR_CODE;
}
