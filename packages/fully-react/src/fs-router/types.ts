export type Route = {
	id: string;
	path: string;
	caseSensitive: boolean;
	children: Route[];
	index: boolean;
	file: string;
};

/**
 * A route that was created using `defineRoutes` or created conventionally from
 * looking at the files on the filesystem.
 */
export interface ConfigPageRoute {
	/**
	 * The path this route uses to match on the URL pathname.
	 */
	path?: string;

	/**
	 * Should be `true` if it is an index route. This disallows child routes.
	 */
	index?: boolean;

	/**
	 * Should be `true` if the `path` is case-sensitive. Defaults to `false`.
	 */
	caseSensitive?: boolean;

	/**
	 * The unique id for this route, named like its `file` but without the
	 * extension. So `app/routes/gists/$username.jsx` will have an `id` of
	 * `routes/gists/$username`.
	 */
	id: string;

	/**
	 * The unique `id` for this route's parent route, if there is one.
	 */
	parentId: string;

	/**
	 * The path to the entry point for this route, relative to
	 * `config.appDirectory`.
	 */
	file: string;

	type: "page";

	component?: React.FC<any>;
}

/**
 * A route that was created using `defineRoutes` or created conventionally from
 * looking at the files on the filesystem.
 */
export interface ConfigRoute {
	/**
	 * The path this route uses to match on the URL pathname.
	 */
	path: string;

	/**
	 * The unique id for this route, named like its `file` but without the
	 * extension. So `app/routes/gists/$username.jsx` will have an `id` of
	 * `routes/gists/$username`.
	 */
	id: string;

	/**
	 * The path to the entry point for this route, relative to
	 * `config.appDirectory`.
	 */
	file: string;

	type: "route";

	parentId?: "route-handler";
}

export interface RouteManifest {
	[routeId: string]: ConfigRoute | ConfigPageRoute;
}
