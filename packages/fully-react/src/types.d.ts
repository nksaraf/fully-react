interface AppEnv {
	readonly ROUTER_MODE: "server" | "client";
	readonly CLIENT_ENTRY: string;
	readonly ROOT_ENTRY: string;
	readonly ROOT_DIR: string;
}

interface ImportMeta {
	app: import("./vite-app-router/App.js").App & AppEnv;
}
