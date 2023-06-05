import { defineConfig } from "tsup";

export default defineConfig([
	{
		entry: ["./src/index.ts"],
		format: ["esm"],
		platform: "node",
		target: "node14",
		external: [],
		dts: true,
	},
	{
		entry: ["./src/cli.ts"],
		format: ["esm"],
		platform: "node",
		target: "node14",
		external: ["@vercel/nft"],
	},
	// {
	// 	entry: {
	// 		index: "./src/vite-plugin.ts",
	// 		cli: "./src/index.ts",
	// 	},
	// 	format: ["esm"],
	// 	platform: "node",
	// 	dts: {
	// 		entry: {
	// 			index: "./src/vite-plugin.ts",
	// 		},
	// 		resolve: false,
	// 	},
	// },
	{
		entry: {
			"entry-vercel": "./src/winterkit/entry/entry-vercel.ts",
		},
		format: ["esm"],
		platform: "node",
		target: "esnext",
		shims: false,
		external: ["sirv", "virtual:entry-server"],
	},
	{
		entry: {
			"entry-node": "./src/winterkit/entry/entry-node.ts",
		},
		format: ["esm"],
		platform: "node",
		target: "esnext",
		shims: false,
		external: ["virtual:entry-server", "compression", "connect"],
		noExternal: ["sirv"],
	},
	{
		entry: {
			node: "./src/winterkit/node.ts",
		},
		dts: true,
		format: ["esm"],
		platform: "node",
		target: "esnext",
		shims: false,
		external: ["virtual:entry-server"],
		noExternal: ["sirv", "@hattip/adapter-node"],
	},
	{
		entry: ["./src/server/*", "./src/shared/*", "./src/entry-server.ts"],
		dts: true,
		format: ["esm"],
		outDir: "./dist",
		platform: "node",
		target: "esnext",
		shims: false,
		external: ["react", "react-dom", "react-server-dom-webpack", "fully-react"],
	},
	{
		entry: {
			"entry-rsc.development": "./src/component-server/entry.tsx",
		},
		env: {
			NODE_ENV: "development",
		},
		dts: false,
		format: ["esm"],
		platform: "node",
		target: "esnext",
		treeshake: true,
		shims: false,
		external: ["fully-react"],
	},
	{
		entry: {
			"entry-rsc.production": "./src/component-server/entry.tsx",
		},
		env: {
			NODE_ENV: "production",
		},
		dts: false,
		minify: true,
		treeshake: true,
		format: ["esm"],
		platform: "node",
		target: "esnext",
		shims: false,
		external: ["fully-react"],
	},
	// {
	// 	entry: ["./src/entry-client.tsx"],
	// 	outDir: "./dist",
	// 	dts: true,
	// 	format: ["esm"],
	// 	platform: "neutral",
	// 	target: "esnext",
	// 	shims: false,
	// 	external: ["./src/web/entry.tsx"],
	// },
]);
