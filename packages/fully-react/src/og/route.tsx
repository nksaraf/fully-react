import { ImageResponse, getFont } from "./ImageResponse";

export async function GET(req: Request) {
	try {
		const values = {
			heading: "",
			mode: "dark",
		};
		const heading =
			values.heading.length > 140
				? `${values.heading.substring(0, 140)}...`
				: values.heading;

		const { mode } = values;
		const paint = mode === "dark" ? "#fff" : "#000";

		const fontSize = heading.length > 100 ? "70px" : "100px";

		return new ImageResponse(
			(
				<div
					tw="flex relative flex-col p-12 w-full h-full items-start"
					style={{
						color: paint,
						background:
							mode === "dark"
								? "linear-gradient(90deg, #000 0%, #111 100%)"
								: "white",
					}}
				>
					<svg width="32" height="32" viewBox="0 0 256 257" fill="none">
						<defs>
							<linearGradient
								id="logosVitejs0"
								x1="-.828%"
								x2="57.636%"
								y1="7.652%"
								y2="78.411%"
							>
								<stop offset="0%" stopColor="#41D1FF"></stop>
								<stop offset="100%" stopColor="#BD34FE"></stop>
							</linearGradient>
							<linearGradient
								id="logosVitejs1"
								x1="43.376%"
								x2="50.316%"
								y1="2.242%"
								y2="89.03%"
							>
								<stop offset="0%" stopColor="#FFEA83"></stop>
								<stop offset="8.333%" stopColor="#FFDD35"></stop>
								<stop offset="100%" stopColor="#FFA800"></stop>
							</linearGradient>
						</defs>
						<path
							fill="url(#logosVitejs0)"
							d="M255.153 37.938L134.897 252.976c-2.483 4.44-8.862 4.466-11.382.048L.875 37.958c-2.746-4.814 1.371-10.646 6.827-9.67l120.385 21.517a6.537 6.537 0 0 0 2.322-.004l117.867-21.483c5.438-.991 9.574 4.796 6.877 9.62Z"
						></path>
						<path
							fill="url(#logosVitejs1)"
							d="M185.432.063L96.44 17.501a3.268 3.268 0 0 0-2.634 3.014l-5.474 92.456a3.268 3.268 0 0 0 3.997 3.378l24.777-5.718c2.318-.535 4.413 1.507 3.936 3.838l-7.361 36.047c-.495 2.426 1.782 4.5 4.151 3.78l15.304-4.649c2.372-.72 4.652 1.36 4.15 3.788l-11.698 56.621c-.732 3.542 3.979 5.473 5.943 2.437l1.313-2.028l72.516-144.72c1.215-2.423-.88-5.186-3.54-4.672l-25.505 4.922c-2.396.462-4.435-1.77-3.759-4.114l16.646-57.705c.677-2.35-1.37-4.583-3.769-4.113Z"
						></path>
					</svg>
					<div tw="flex flex-col flex-1 py-10">
						<div
							tw="flex text-xl uppercase font-bold tracking-tight"
							style={{ fontFamily: "Inter", fontWeight: "normal" }}
						>
							Example
						</div>
						<div
							tw="flex leading-[1.1] text-[80px] font-bold"
							style={{
								fontFamily: "Cal Sans",
								fontWeight: "bold",
								marginLeft: "-3px",
								fontSize,
							}}
						>
							Server Components Form
						</div>
					</div>
					<div tw="flex items-center w-full justify-between">
						<div
							tw="flex items-center text-xl"
							style={{ fontFamily: "Inter", fontWeight: "normal" }}
						>
							<svg width="32" height="32" viewBox="0 0 48 48" fill="none">
								<path
									d="M30 44v-8a9.6 9.6 0 0 0-2-7c6 0 12-4 12-11 .16-2.5-.54-4.96-2-7 .56-2.3.56-4.7 0-7 0 0-2 0-6 3-5.28-1-10.72-1-16 0-4-3-6-3-6-3-.6 2.3-.6 4.7 0 7a10.806 10.806 0 0 0-2 7c0 7 6 11 12 11a9.43 9.43 0 0 0-1.7 3.3c-.34 1.2-.44 2.46-.3 3.7v8"
									stroke={paint}
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								/>
								<path
									d="M18 36c-9.02 4-10-4-14-4"
									stroke={paint}
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								/>
							</svg>
							<div tw="flex ml-2">nksaraf/fully-react</div>
						</div>
					</div>
				</div>
			),
			{
				width: 1200,
				height: 630,
				fonts: await getFont("Inter"),
			},
		);
	} catch (error) {
		console.error(error);
		return new Response(`Failed to generate image`, {
			status: 500,
		});
	}
}
