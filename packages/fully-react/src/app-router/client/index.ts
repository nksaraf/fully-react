import {
	AnyRoute,
	ParsePathParams,
	RootRoute,
	TypedRoute,
} from "./router/types";

export { A } from "../shared/A";
export * from "../../client/router";
export { default as Router } from "./router/app-router";
export { interpolatePath } from "./router/types/path";
export type { LinkFn as TypedLink } from "./router/link";
export type { PageProps } from "../types";

export type TypedRouteModule<
	TParentRoute extends AnyRoute = AnyRoute,
	TPath extends string = string,
	mod extends { default: any } = { default: any },
> = TypedRoute<
	TParentRoute,
	TPath,
	mod extends { config: { validateSearch: any } }
		? ReturnType<mod["config"]["validateSearch"]>
		: {},
	mod extends { config: { parseParams: any } }
		? ReturnType<mod["config"]["parseParams"]>
		: Record<ParsePathParams<TPath>, string>
>;

export type TypedRootRoute<mod extends { default: any }> = RootRoute<
	unknown,
	mod extends { config: { validateSearch: any } }
		? ReturnType<mod["config"]["validateSearch"]>
		: {}
>;

export type {
	Register,
	Route,
	Router as TypedRouter,
	TypedRoute,
	RootRoute,
	RouteWithChildren,
	TypedRouteOptions,
} from "./router/types";
