/**
 * @typedef {import("vite").ModuleNode} ModuleNode
 * @typedef {import("vite").ViteDevServer} ViteDevServer
 */
import path from "node:path";

/**
 * Recursively finds dependencies of a module.
 *
 * @param {ViteDevServer} vite - Vite development server instance.
 * @param {ModuleNode} node - The module node to find dependencies for.
 * @param {Set<ModuleNode>} deps - Set to store the found dependencies.
 * @returns {Promise<void>}
 */
async function find_deps(vite, node, deps) {
	/**
	 * @type {Promise<void>[]}
	 */
	const branches = [];

	/**
	 * Adds the given module node to the dependencies set and recursively finds its dependencies.
	 *
	 * @param {ModuleNode} node - The module node to add.
	 * @returns {Promise<void>}
	 */
	async function add(node) {
		if (!deps.has(node)) {
			deps.add(node);
			await find_deps(vite, node, deps);
		}
	}

	/**
	 * Adds the module node identified by the given URL to the dependencies set.
	 *
	 * @param {string} url - The URL of the module node to add.
	 * @returns {Promise<void>}
	 */
	async function add_by_url(url) {
		const node = await vite.moduleGraph.getModuleByUrl(url);

		if (node) {
			await add(node);
		}
	}

	if (node.ssrTransformResult) {
		if (node.ssrTransformResult.deps) {
			node.ssrTransformResult.deps.forEach((url) =>
				branches.push(add_by_url(url)),
			);
		}

		// if (node.ssrTransformResult.dynamicDeps) {
		//   node.ssrTransformResult.dynamicDeps.forEach(url => branches.push(add_by_url(url)));
		// }
	} else {
		node.importedModules.forEach((node) => branches.push(add(node)));
	}

	await Promise.all(branches);
}

/**
 * Regular expression pattern to match style file extensions.
 *
 * @type {RegExp}
 */
const style_pattern = /\.(css|less|sass|scss|styl|stylus|pcss|postcss)$/;

/**
 * Regular expression pattern to match module style file extensions.
 *
 * @type {RegExp}
 */
const module_style_pattern =
	/\.module\.(css|less|sass|scss|styl|stylus|pcss|postcss)$/;

/**
 * Collects stylesheets from the given ViteDevServer instance for the specified file paths.
 *
 * @param {ViteDevServer} devServer - Vite development server instance.
 * @param {string[]} match - An array of file paths to match.
 * @returns {Promise<{ [key: string]: string }>} - An object containing the collected styles.
 */
export async function collectStyles(devServer, match) {
	/**
	 * @type {{ [key: string]: string }}
	 */
	const styles = {};

	/**
	 * @type {Set<ModuleNode>}
	 */
	const deps = new Set();

	try {
		for (const file of match) {
			const resolvedId = await devServer.pluginContainer.resolveId(file);

			if (!resolvedId) {
				console.log("not found");
				continue;
			}

			const id = resolvedId.id;

			const normalizedPath = path.resolve(id).replace(/\\/g, "/");
			let node = devServer.moduleGraph.getModuleById(normalizedPath);

			if (!node) {
				const absolutePath = path.resolve(file);
				await devServer.ssrLoadModule(absolutePath);
				node = await devServer.moduleGraph.getModuleByUrl(absolutePath);

				if (!node) {
					console.log("not found");
					return {};
				}
			}

			await find_deps(devServer, node, deps);
		}
	} catch (e) {
		console.error(e);
	}

	for (const dep of deps) {
		const parsed = new URL(dep.url, "http://localhost/");
		const query = parsed.searchParams;

		if (style_pattern.test(dep.file ?? "")) {
			try {
				const mod = await devServer.ssrLoadModule(dep.url);
				// if (module_style_pattern.test(dep.file)) {
				// 	styles[dep.url] = env.cssModules?.[dep.file];
				// } else {
				styles[dep.url] = mod.default;
				// }
			} catch {
				// this can happen with dynamically imported modules, I think
				// because the Vite module graph doesn't distinguish between
				// static and dynamic imports? TODO investigate, submit fix
			}
		}
	}

	return styles;
}
