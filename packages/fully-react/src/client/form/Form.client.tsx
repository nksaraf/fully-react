"use client";

import React from "react";

import { useSubmitForm } from "../form";

export function ClientForm({ ...props }: React.ComponentProps<"form">) {
	const submitForm = useSubmitForm();
	return (
		<form
			method="post"
			{...props}
			onSubmit={(e) => {
				e.preventDefault();
				submitForm(new FormData(e.currentTarget));
			}}
		>
			{props.children}
		</form>
	);
}
