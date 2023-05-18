import { getCount, increment } from "./api";
import { Counter } from "./counter";

export default async function Root() {
	return (
		<>
			<meta name="description" content="asdasd" />
			<Counter increment={increment} count={await getCount()} />
		</>
	);
}
