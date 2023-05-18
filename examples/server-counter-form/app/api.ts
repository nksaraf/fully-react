"use server";

import { execute } from "./db";
import { redirect } from "fully-react/navigation";

export async function increment() {
	await db.execute("UPDATE Counter SET value = value + 1");
	redirect("/");
}

export async function getCount() {
	try {
		let result = await execute<{ value: number }>(
			"SELECT value from Counter LIMIT 1",
		);
		return result.rows[0].value ?? 0;
	} catch (e) {
		console.log(e);
		throw e;
	}
}
