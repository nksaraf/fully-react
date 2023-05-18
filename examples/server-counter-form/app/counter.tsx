"use client";
import { useAction } from "./useAction";

export function Counter({
	count,
	increment,
}: {
	count: number;
	increment: () => Promise<void>;
}) {
	const [optimisticCount, CounterForm] = useAction(
		increment,
		count,
		(prev) => prev + 1,
	);
	return (
		<CounterForm>
			<div>{optimisticCount}</div>
			<button>
				<CounterForm.Pending pending="Incrementing..." idle="Increment" />
			</button>
		</CounterForm>
	);
}
