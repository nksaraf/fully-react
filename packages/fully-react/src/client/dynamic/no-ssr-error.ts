// This has to be a shared module which is shared between client component error boundary and dynamic component

export const NO_SSR_CODE = "NO_SSR";

export function isNoSSRError(error: any) {
	return error.digest === NO_SSR_CODE;
}
