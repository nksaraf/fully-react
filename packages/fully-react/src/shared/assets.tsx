import { ReactRefreshScript } from "../server/dev/react-refresh-script";
import { use } from "react";

type AssetDesc = string | { type: "style"; style: string; src?: string };

const linkProps = [
	["js", { rel: "modulepreload", crossOrigin: "" }],
	["jsx", { rel: "modulepreload", crossOrigin: "" }],
	["ts", { rel: "modulepreload", crossOrigin: "" }],
	["tsx", { rel: "modulepreload", crossOrigin: "" }],
	["css", { rel: "stylesheet", precedence: "high" }],
	["woff", { rel: "preload", as: "font", type: "font/woff", crossOrigin: "" }],
	[
		"woff2",
		{ rel: "preload", as: "font", type: "font/woff2", crossOrigin: "" },
	],
	["gif", { rel: "preload", as: "image", type: "image/gif" }],
	["jpg", { rel: "preload", as: "image", type: "image/jpeg" }],
	["jpeg", { rel: "preload", as: "image", type: "image/jpeg" }],
	["png", { rel: "preload", as: "image", type: "image/png" }],
	["webp", { rel: "preload", as: "image", type: "image/webp" }],
	["svg", { rel: "preload", as: "image", type: "image/svg+xml" }],
	["ico", { rel: "preload", as: "image", type: "image/x-icon" }],
	["avif", { rel: "preload", as: "image", type: "image/avif" }],
	["mp4", { rel: "preload", as: "video", type: "video/mp4" }],
	["webm", { rel: "preload", as: "video", type: "video/webm" }],
] as const;

type Linkprop = (typeof linkProps)[number][1];

const linkPropsMap = new Map<string, Linkprop>(linkProps);

/**
 * Generates a link tag for a given file. This will load stylesheets and preload
 * everything else. It uses the file extension to determine the type.
 */
export const Asset = ({ file }: { file: string }) => {
	const ext = file.split(".").pop();
	if (!ext) {
		return null;
	}

	const props = linkPropsMap.get(ext);
	if (!props) {
		return null;
	}

	return <link href={file} {...props} />;
};

/**
 * Generates a link tag for a given file. This will load stylesheets and preload
 * everything else. It uses the file extension to determine the type.
 */
export const Style = ({ style, src }: { style: string; src?: string }) => {
	return (
		<style
			dangerouslySetInnerHTML={{ __html: style }}
			suppressHydrationWarning={true}
		/>
	);
};

export function Assets({ assets = [] }: { assets?: AssetDesc[] }) {
	return (
		<>
			{import.meta.env.ROUTER_MODE === "server" ? (
				<ServerAssets />
			) : import.meta.env.SSR ? (
				<ClientAssets />
			) : null}
			{import.meta.env.DEV ? <ReactRefreshScript /> : null}
		</>
	);
}

export async function ServerAssets() {
	const allAssets = [...new Set([...(await context.findAssets(""))]).values()];
	return (
		<>
			{allAssets.map((asset, index) => {
				if (typeof asset === "string") {
					return <Asset file={asset} key={asset} />;
				} else if (asset.type === "style") {
					return <Style style={asset.style} key={asset.src ?? `${index}`} />;
				}
			})}
		</>
	);
}

const findAssets = async () => {
	return [...new Set([...(await context.findAssets(""))]).values()];
};

export function ClientAssets() {
	const allAssets = use(findAssets());

	return (
		<>
			{allAssets.map((asset, index) => {
				if (typeof asset === "string") {
					return <Asset file={asset} key={asset} />;
				} else if (asset.type === "style") {
					return <Style style={asset.style} key={asset.src ?? `${index}`} />;
				}
			})}
		</>
	);
}
