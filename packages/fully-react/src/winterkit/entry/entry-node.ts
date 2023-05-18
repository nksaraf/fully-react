import sirv, { Options, RequestHandler } from "sirv";
import compression from "compression";
import connect from "connect";
import { HattipHandler } from "@hattip/core";
import { createMiddleware } from "@hattip/adapter-node";
import { createServer } from "node:http";

let entryServer: {
	default: HattipHandler;
	sirvOptions?: Options;
};

let sirvHandler: RequestHandler;

async function init() {
	// @ts-expect-error: This is a virtual module
	// eslint-disable-next-line import/no-unresolved
	entryServer = await import("virtual:entry-server");

	const middleware = createMiddleware(entryServer.default);

	sirvHandler = sirv(
		// @ts-expect-error: This will be defined by the plugin
		CLIENT_BUILD_OUTPUT_DIR,
		entryServer.sirvOptions,
	);

	const PORT = Number(process.env.PORT) || 3000;
	const HOST = process.env.HOST || "localhost";

	const app = connect();

	// @ts-ignore
	app.use(compression());

	app.use(sirvHandler);

	app.use(middleware);

	app.use((req, res) => {
		if (!res.writableEnded) {
			res.statusCode = 404;
			res.end();
		}
	});

	createServer(app).listen(PORT, HOST, () => {
		// eslint-disable-next-line no-console
		console.log(`Server listening on http://${HOST}:${PORT}`);
	});
}

init();
