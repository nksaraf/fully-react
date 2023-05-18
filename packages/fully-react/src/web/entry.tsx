import React, { startTransition } from "react";
import { createRoot, hydrateRoot, HydrationOptions } from "react-dom/client";
import { setupWebpackEnv } from "./webpack";
import { initMutation } from "../client/mutation";
import { isNotFoundError, isRedirectError } from "../shared/navigation";
import { isNoSSRError } from "../client/dynamic/no-ssr-error";

export * from "./root";

function pathRelative(from: string, to: string) {
	const fromParts = from.split("/").filter(Boolean);
	const toParts = to.split("/").filter(Boolean);

	let commonLength = 0;
	for (let i = 0; i < Math.min(fromParts.length, toParts.length); i++) {
		if (fromParts[i] === toParts[i]) {
			commonLength = i + 1;
		} else {
			break;
		}
	}

	const upLevel = fromParts.length - commonLength;
	let relativePath = "";

	for (let i = 0; i < upLevel; i++) {
		relativePath += "../";
	}

	for (let i = commonLength; i < toParts.length; i++) {
		relativePath += toParts[i] + (i < toParts.length - 1 ? "/" : "");
	}

	return relativePath || "./";
}

export function loadModule(id: string) {
	if (import.meta.env.PROD) {
		const assetPath: string = globalThis.manifest.client[id];

		if (!assetPath) {
			throw new Error(`Could not find asset for ${id}`);
		}
		return import(/* @vite-ignore */ assetPath);
	} else {
		const importPath = `/@fs${id}`;
		return import(/* @vite-ignore */ importPath);
	}
}

const onDocumentLoad = (fn: () => void) => {
	if (document.readyState !== "loading") {
		setTimeout(fn);
	} else {
		document.addEventListener("DOMContentLoaded", () => {
			fn();
		});
	}
};

export function mount(
	element: JSX.Element,
	{
		loadModule: _loadModule,
		onRecoverableError = (err: any) => {
			const digest = err.digest;

			// Using default react onRecoverableError
			// x-ref: https://github.com/facebook/react/blob/d4bc16a7d69eb2ea38a88c8ac0b461d5f72cdcab/packages/react-dom/src/client/ReactDOMRoot.js#L83
			const defaultOnRecoverableError =
				typeof reportError === "function"
					? // In modern browsers, reportError will dispatch an error event,
					  // emulating an uncaught JavaScript error.
					  reportError
					: (error: any) => {
							window.console.error(error);
					  };

			// Skip certain custom errors which are not expected to be reported on client
			if (isNoSSRError({ digest })) return;
			defaultOnRecoverableError(err);
		},
		...hydrationOptions
	}: {
		loadModule?: (chunk: string) => Promise<any>;
	} & Partial<HydrationOptions> = {
		loadModule,
	},
) {
	setupWebpackEnv(_loadModule);
	initMutation();
	if (window.document.documentElement.id === "__error__") {
		createRoot(document as unknown as HTMLElement).render(element);
	} else {
		onDocumentLoad(() =>
			startTransition(() => {
				hydrateRoot(document, element, {
					...hydrationOptions,
					onRecoverableError,
				});
			}),
		);
	}
}
