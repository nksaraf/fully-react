import React from "react";
import { matchRoutes } from "../client/router/matchRoutes";
import Router from "../client/router/app-router";
import { createLocation, createPath } from "../../fs-router/path";
import { PageProps } from "../types";
import { renderMatches } from "./create-router";
import { ServerContext } from "../../server/ServerContext";

function AppRouter({ context, url }: { context: ServerContext; url: string }) {
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
