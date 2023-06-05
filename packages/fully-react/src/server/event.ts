import { Locals, RequestContext } from "@hattip/compose";

export class FetchEvent implements RequestContext {
	type = "fetch" as const;
	request: Request;
	ip: string;
	platform: any;
	waitUntil: (promise: Promise<any>) => void;
	passThrough: () => void;
	url: URL;
	method: string;
	locals: Locals;

	/**
	 *
	 * @param {Request} request
	 * @param param1
	 */
	constructor(
		request: Request,
		{
			ip,
			platform,
			waitUntil,
			passThrough,
		}: {
			ip: string;
			platform: any;
			waitUntil: (promise: Promise<any>) => void;
			passThrough: () => void;
		},
	) {
		this.request = request;
		this.url = new URL(request.url);
		this.method = request.method;
		this.locals = {};
		this.ip = ip;
		this.platform = platform;
		this.waitUntil = waitUntil;
		this.passThrough = passThrough;
	}

	next(): Promise<Response> {
		throw new Error("Method not implemented.");
	}
	handleError(error: unknown): Response | Promise<Response> {
		throw new Error("Method not implemented.");
	}
	params: any;
}

export type FetchHandler = (event: FetchEvent) => Response | Promise<Response>;
