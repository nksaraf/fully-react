import { Resvg } from "@resvg/resvg-js";
import satori, { SatoriOptions } from "satori";

// add tw prop to JSX.IntrinsicElements

declare global {
	namespace React {
		interface HTMLAttributes<T> {
			tw?: string;
		}
	}
}
export async function getFont(
	font: string,
	weights = [400, 500, 600, 700],
	text = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/\\!@#$%^&*()_+-=<>?[]{}|;:,.`'’\"–—",
) {
	const css = await fetch(
		`https://fonts.googleapis.com/css2?family=${font}:wght@${weights.join(
			";",
		)}&text=${encodeURIComponent(text)}`,
		{
			headers: {
				// Make sure it returns TTF.
				"User-Agent":
					"Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1",
			},
		},
	).then((response) => response.text());
	const resource = css.matchAll(
		/src: url\((.+)\) format\('(opentype|truetype)'\)/g,
	);
	return Promise.all(
		[...resource]
			.map((match) => match[1])
			.map((url) => fetch(url).then((response) => response.arrayBuffer()))
			.map(async (buffer, i) => ({
				name: font,
				style: "normal",
				weight: weights[i],
				data: await buffer,
			})),
	) as Promise<SatoriOptions["fonts"]>;
}

export class ImageResponse extends Response {
	constructor(
		element: JSX.Element,
		opts: SatoriOptions & {
			headers?: Record<string, string>;
			status?: number;
			statusText?: string;
		},
	) {
		const options = Object.assign(
			{
				width: 1200,
				height: 630,
				debug: false,
			},
			opts,
		);

		const result = new ReadableStream({
			async start(controller) {
				const fonts = options.fonts ?? (await getFont("Inter"));
				const svg = await satori(element, {
					...options,
					fonts,
				});

				// const svg = await satori2(element, {
				// 	width: options.width,
				// 	height: options.height,
				// 	debug: options.debug,
				// 	fonts: options.fonts || defaultFonts,
				// 	loadAdditionalAsset: loadDynamicAsset({
				// 		emoji: options.emoji,
				// 	}),
				// });
				const resvgJS = new Resvg(svg, {
					fitTo: {
						mode: "width",
						value: options.width,
					},
				});
				controller.enqueue(resvgJS.render().asPng());
				controller.close();
			},
		});

		super(result, {
			headers: {
				"content-type": "image/png",
				"cache-control": import.meta.env.DEV
					? "no-cache, no-store"
					: "public, immutable, no-transform, max-age=31536000",
				...(options.headers ?? {}),
			},
			status: options.status,
			statusText: options.statusText,
		});
	}
}
