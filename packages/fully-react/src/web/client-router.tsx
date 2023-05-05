import FSRouter from "../app-router/fs";

export function Router() {
	return (
		<FSRouter
			url={typeof window !== "undefined" ? window.location.href : ""}
			headers={{}}
			params={{}}
			searchParams={{}}
		/>
	);
}
