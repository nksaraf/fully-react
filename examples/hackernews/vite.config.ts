import { defineConfig } from "vite";
import react from "fully-react";
import inspect from "@vinxi/vite-plugin-inspect";

export default defineConfig({
	plugins: [
		inspect({
			outDir: ".vite/inspect",
		}),
		react(),
	],
});
