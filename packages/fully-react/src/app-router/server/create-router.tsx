import React from "react";

import { createLocation, createPath } from "../../app-context/path";
import { Assets } from "../../react/html/assets";
import Router, { LayoutRouter } from "../client/router/app-router";
import { matchRoutes } from "../client/router/matchRoutes";
import { RouteMatch, RouteObject } from "../client/router/utils";
import { PageProps } from "../types";
import { StatusCode } from "./StatusCode";

export function renderMatches(
	matches: RouteMatch[],
	props: PageProps,
): React.ReactElement | null {
	const renderedMatches = matches;

	return renderedMatches.reduceRight((outlet, match) => {
		const getChildren = () => {
			if (match.route.component) {
				return (
					<LayoutRouter
						segment={match.pathname}
						child={<match.route.component children={outlet} {...props} />}
					/>
				);
			}

			return <div>404</div>;
		};
		return getChildren();
	}, null as React.ReactElement | null);
}

function DefaultErrorComponent() {
	return (
		<html lang="en">
			<head>
				<title>RSC Playground</title>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<link rel="icon" type="image/x-icon" href="/favicon.ico" />
				<Assets />
				{import.meta.env.SSR ? <StatusCode code={404} /> : null}
			</head>
			<body>
				<div>404</div>
			</body>
		</html>
	);
}

const createLayoutCacheRoot = () => {
	return {
		segment: "<root>",
		subTree: null,
		children: new Map(),
	};
};

export function createRouter(
	routes: RouteObject[],
	{
		errorComponent = DefaultErrorComponent,
		notFoundComponent = DefaultErrorComponent,
	} = {},
) {
	function AppRouter(props: PageProps) {
		const basename = "/";
		const url = new URL(props.url);
		const location = createLocation("", createPath(url), null, "default");
		const matches = matchRoutes(routes, location, basename);

		const NotFound = routes[0]?.component ?? notFoundComponent;
		const notFound = (
			<NotFound {...props} params={{}} children={<div>404</div>} />
		);

		let content: React.ReactNode = notFound;

		if (matches) {
			const params = matches.reduce((params, match) => {
				return { ...params, ...match.params };
			}, {});

			content = renderMatches(matches, {
				...props,
				params,
			});
		}

		const isClientNavigation =
			props.headers["x-navigate"] || props.headers["x-mutation"];

		if (isClientNavigation) {
			return content;
		}

		return (
			<Router initialURL={location.pathname}>
				{content}
				{/* <SegmentContext.Provider
					value={{
						cacheNode: createLayoutCacheRoot(),
						remainingPath: parsePath(location.pathname),
					}}
				>
					{x}
				</SegmentContext.Provider> */}
			</Router>
		);
	}

	return AppRouter;
}
