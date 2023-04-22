import { defineConfig } from "vite";
import mdx from "@cyco130/vite-plugin-mdx";
import react from "fully-react";
export default defineConfig({
	plugins: [mdx({}), react()],
});
