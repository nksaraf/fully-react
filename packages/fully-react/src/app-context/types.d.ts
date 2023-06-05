declare type RouterContext = {
	matchRoutes();
};

declare module "@milahu/debug-esm" {
	interface Debugger {
		(message: string, ...args: any[]): void;
		enabled: boolean;
		extend: (namespace: string) => Debugger;
	}

	export default function debug(name: string): Debugger;
}
