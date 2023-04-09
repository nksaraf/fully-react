"use client";

import React, { AnchorHTMLAttributes, DetailedHTMLProps } from "react";
import { useRouter } from "./useRouter";
import { LinkFn } from "../client/router/link";
import { interpolatePath } from "../client/router/types";

export const A: LinkFn<{}> = function A({
	activeProps = {},
	...props
}: {
	activeProps?: DetailedHTMLProps<
		AnchorHTMLAttributes<HTMLAnchorElement>,
		HTMLAnchorElement
	>;
} & DetailedHTMLProps<
	AnchorHTMLAttributes<HTMLAnchorElement>,
	HTMLAnchorElement
> &
	any) {
	const router = useRouter();
	const href = props.href ?? interpolatePath(props.to, props.params);
	const isActive = router.url === href;
	return (
		<a
			href={href}
			onClick={(e) => {
				if (e.defaultPrevented) return;
				e.preventDefault();
				router.push(href);
			}}
			{...props}
			{...(isActive ? activeProps : {})}
		/>
	);
};