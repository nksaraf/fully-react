import handler from "virtual:entry-server";
import { createMiddleware } from "@hattip/adapter-node";
export default createMiddleware(handler);
