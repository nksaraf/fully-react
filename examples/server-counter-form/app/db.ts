import { Connection, connect } from "@planetscale/database";

declare global {
	var db: Connection;
}

globalThis.db =
	globalThis.db ||
	connect({
		url: import.meta.env.VITE_DATABASE_URL,
	});

export default globalThis.db;

export function execute<T>(query: string) {
	return globalThis.db.execute(query) as unknown as Promise<{ rows: T[] }>;
}
