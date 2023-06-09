import {
	createFromFetch,
	createFromReadableStream,
	encodeReply as encodeActionArgs,
} from "react-server-dom-webpack/client.browser";

export async function callServer(id: string, args: any[]) {
	const actionId = id;

	// const isMutating = !!globalThis.isMutating;

	const response = await fetch("", {
		method: "POST",
		headers: {
			Accept: "text/x-component",
			"x-action": actionId,
			"x-mutation": "1",
		},
		body: await encodeActionArgs(args),
	});

	if (!response.ok) {
		throw new Error("Server error");
	}

	const data = createFromReadableStream(response.body!, { callServer });

	// if (isMutating) {
	globalThis.mutate(data);
	// }

	return data;
}

export function createElementFromServer(url = "") {
	return createFromFetch(
		fetch(url + ".rsc", {
			headers: {
				Accept: "text/x-component",
				"x-rsc": "1",
				"x-navigate": url,
			},
		}),
		{ callServer },
	);
}

function createDevtoolsStream() {
	const decoder = new TextDecoder();
	let previousChunkTime: number | null = null;
	const transformStream = new TransformStream({
		transform(chunk, controller) {
			const currentTime = Date.now();

			if (previousChunkTime !== null) {
				const timeDifference = currentTime - previousChunkTime;
				console.log(`Time difference from previous chunk: ${timeDifference}ms`);
			} else {
				console.log("Received the first chunk");
			}

			console.log(`Chunk: ${decoder.decode(chunk)}`);
			previousChunkTime = currentTime;

			// Pass the chunk along the stream without modification
			controller.enqueue(chunk);
		},
	});
	return transformStream;
}

export async function createElementFromStream(
	stream: ReadableStream | Promise<ReadableStream>,
	config: {
		callServer: any;
	},
) {
	stream = await stream;
	if (import.meta.env.DEV) {
		const devtoolsStream = createDevtoolsStream();
		stream = stream.pipeThrough(devtoolsStream);
	}

	return createFromReadableStream(stream, config);
}
