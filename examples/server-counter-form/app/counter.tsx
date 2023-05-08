"use client";

import { experimental_useFormStatus as useFormStatus } from "react-dom";
import { experimental_useOptimistic as useOptimisticState } from "react";
import { increment } from "./api";

export function Button({ children, pending }) {
	const status = useFormStatus();
	return <button>{status.pending ? pending : children}</button>;
}

declare global {
	namespace React {
		interface FormHTMLAttributes {
			action?: Promise<any> | string | undefined;
		}
	}
}

export function Counter({ count }) {
	const [state, optimisticIcrement] = useOptimisticState(
		count,
		(prev) => prev + 1,
	);
	return (
		<form
			action={async (formData) => {
				optimisticIcrement();
				await increment();
			}}
		>
			<div>{state}</div>
			<Button pending="Incrementing...">Increment</Button>
		</form>
	);
}
