import { A } from "fully-react/link";

import "./style.css";

export default function Layout({ children, params }) {
	console.log("app/[country]/layout.tsx", params);
	return (
		<div>
			{children}

			<A href="/us/florida">Florida</A>
			<A href="/in/punjab">Punjab</A>
		</div>
	);
}
