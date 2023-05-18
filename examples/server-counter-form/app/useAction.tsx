"use client";
import { experimental_useFormStatus as useFormStatus } from "react-dom";
import {
	createContext,
	useMemo,
	experimental_useOptimistic as useOptimistic,
} from "react";

const formContext = createContext(undefined as {} | undefined);

export function useAction<T>(func: any, currState: T, update: (a: T) => T) {
	const [state, optimisticUpdate] = useOptimistic(currState, (prev: T) =>
		update(prev),
	);

	const Pending = useMemo(
		() =>
			function Pending({
				idle,
				pending,
			}: {
				idle: React.ReactNode;
				pending: React.ReactNode;
			}) {
				const status = useFormStatus();
				return <>{status.pending ? pending : idle}</>;
			},
		[],
	);

	let Form = useMemo(
		() =>
			function Form({ children }: { children: React.ReactNode }) {
				return (
					<form
						// @ts-expect-error Form actions
						action={(formData: FormData) => {
							optimisticUpdate();
							return func();
						}}
					>
						{children}
					</form>
				);
			},
		[optimisticUpdate],
	);

	Form = Object.assign(Form, {
		Pending,
	});

	return [
		state,
		Form as typeof Form & {
			Pending: typeof Pending;
		},
	] as const;
}
