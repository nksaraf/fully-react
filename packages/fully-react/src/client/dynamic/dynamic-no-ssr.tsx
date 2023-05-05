"use client";

import React from "react";
import { NO_SSR_CODE as NO_SSR_CODE } from "./no-ssr-error";

export function suspense() {
	const error = new Error(NO_SSR_CODE);
	(error as any).digest = NO_SSR_CODE;
	throw error;
}

type Child = React.ReactElement<any, any>;

export function NoSSR({ children }: { children: Child }): Child {
	if (typeof window === "undefined") {
		suspense();
	}

	return children;
}
