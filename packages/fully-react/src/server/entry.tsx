import type { Context } from "./context";
import { createRequestRouter } from "./handler";
import { DevServerContext, ProdServerContext } from "./ServerContext";

const Context = import.meta.env.PROD ? ProdServerContext : DevServerContext;

type Handler = ({
	request,
}: {
	request: Request;
}) => Promise<Response> | Response;

export function createHandler() {
	const context = new Context();
	context.setupWebpackEnv();
	globalThis.context = context;
	return createRequestRouter(context).buildHandler() as Handler;
}
