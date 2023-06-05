import React from "react";

import { AppContext } from "../../app-context/AppContext";
import { createLocation, createPath } from "../../app-context/path";
import Router from "../client/router/app-router";
import { matchRoutes } from "../client/router/matchRoutes";
import { PageProps } from "../types";
import { renderMatches } from "./create-router";

function AppRouter({ context, url }: { context: AppContext; url: string }) {
	const [location, matches] = context.matchRoutes(url);

	const NotFound = context.notFoundComponent();
	const notFound = (
		<NotFound
			url={url}
			searchParams={{}}
			params={{}}
			children={<div>404</div>}
		/>
	);

	let content: React.ReactNode = notFound;

	if (matches) {
		const params = matches.reduce((params, match) => {
			return { ...params, ...match.params };
		}, {});

		content = renderMatches(matches, {
			url,
			params,
			searchParams: {},
			headers: {},
		});
	}

	return <Router initialURL={location.pathname}>{content}</Router>;
}
