import { A } from "fully-react/link";

export default function Layout({ children, params }) {
	console.log("app/[country]/layout.tsx", params);
	return (
		<div>
			{children}
			<link
				rel="stylesheet"
				href="/app/[country]/style.css"
				precedence="default"
			/>
			<A href="/us/florida">Florida</A>
			<A href="/in/punjab">Punjab</A>
		</div>
	);
}
