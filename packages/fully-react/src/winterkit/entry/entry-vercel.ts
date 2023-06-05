import { createMiddleware } from "@hattip/adapter-node";
import handler from "virtual:entry-server";

export default createMiddleware(handler);
