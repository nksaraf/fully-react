import "./root.css";

import { ErrorBoundary, ResetButton } from "fully-react/error-boundary";
import { getCount, increment } from "./api";

import { Assets } from "fully-react/assets";

import { Counter } from "./counter";

export default async function Root() {
	return (
		<html lang="en">
			<head>
				<title>RSC Playground</title>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<link rel="icon" type="image/x-icon" href="/favicon.ico" />
				<Assets />
			</head>
			<body>
				<div id="root">
					<ErrorBoundary
						fallback={
							<div>
								Error<ResetButton>Reset</ResetButton>
							</div>
						}
					>
						<Counter increment={increment} count={await getCount()} />
					</ErrorBoundary>
				</div>
			</body>
		</html>
	);
}
