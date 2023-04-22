import { createNestedPageRoutes } from "../fs-router/nested";
import { createRouter } from "./server/create-router";

const routes = createNestedPageRoutes(globalThis.env, "root");

export default createRouter(routes);
