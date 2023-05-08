"use client";

import { experimental_useFormStatus as useFormStatus } from "react-dom";
import { experimental_useOptimistic as useOptimisticState } from "react";

function Button({ children, pending }) {
	const status = useFormStatus();
	return <button>{status.pending ? pending : children}</button>;
}

export function Counter({ count, increment }) {
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
