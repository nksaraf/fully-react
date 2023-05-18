import "./layout.css";
import { Assets } from "fully-react/assets";
import { LayoutProps } from "./layout.types";

export default function Root({ children }: LayoutProps) {
	return (
		<html lang="en">
			<head>
				<title>RSC Playground</title>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<link rel="icon" type="image/x-icon" href="/favicon.ico" />
				<Assets />
			</head>
			<body>{children}</body>
		</html>
	);
}
