"use client";

import { useCallback } from "react";
import { createFromReadableStream } from "react-server-dom-webpack/client.browser";

import { useRouter } from "../router/use-router";
import { callServer } from "../stream";

export async function submitForm(formData: FormData) {
	const response = await fetch("", {
		method: "POST",
		headers: {
			Accept: "text/x-component",
			"x-action": formData.get("$$id") as string,
			"x-mutation": "1",
		},
		body: formData,
	});

	if (!response.ok) {
		throw new Error("Server error");
	}

	return response;
}

export function useSubmitForm() {
	const router = useRouter();
	return useCallback(
		async (formData: FormData) => {
			const response = await submitForm(formData);

			const redirectURL = response.headers.get("x-redirect");
			const data = createFromReadableStream(response.body!, { callServer });
			if (redirectURL) {
				router.cache.set(redirectURL, data);
				router.push(redirectURL);
			} else {
				// @ts-ignore
				globalThis.mutate(data);
			}

			return data;
		},
		[router],
	);
}
