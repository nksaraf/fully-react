"use client";

import { experimental_useFormStatus as useFormStatus } from "react-dom";
import { experimental_useOptimistic as useOptimisticState } from "react";
export function Pending() {
	const status = useFormStatus();
	console.log(status);

	return <div>{status.pending ? "Incrementing..." : ""}</div>;
}

declare global {
	namespace React {
		interface FormHTMLAttributes {
			action?: Promise<any> | string | undefined;
		}
	}
}

export function OptimisticCount({ count }) {}

export function Form({ increment, count }) {
	const [state, optimisticIcrement] = useOptimisticState(
		count,
		(prev) => prev + 1,
	);
	return (
		<form>
			<div>{state}</div>
			<button
				formAction={async (formData) => {
					optimisticIcrement();
					await increment();
				}}
			>
				Increment
				<Pending />
			</button>
		</form>
	);
}
