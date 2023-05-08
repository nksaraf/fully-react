"use client";

import { experimental_useFormStatus as useFormStatus } from "react-dom";
import { experimental_useOptimistic as useOptimistic } from "react";

function Button({ children, pending }) {
	const status = useFormStatus();
	return <button>{status.pending ? pending : children}</button>;
}

export function Counter({ count, increment }) {
	const [state, optimisticIncrement] = useOptimistic(count, (prev) => prev + 1);
	return (
		<form
			action={async (formData) => {
				optimisticIncrement();
				await increment();
			}}
		>
			<div>{state}</div>
			<Button pending="Incrementing...">Increment</Button>
		</form>
	);
}
