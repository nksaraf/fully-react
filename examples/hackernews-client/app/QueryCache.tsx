import {
	DehydratedState,
	QueryClient,
	QueryClientProvider,
	hydrate,
} from "@tanstack/react-query";
import {
	DataCache,
	DataCacheSingleton,
	DataProvider,
} from "fully-react/cache";
import { response } from "fully-react/request";
import { useRef, useState } from "react";

export class QueryCache extends DataCache {
	queryClient: QueryClient;
	constructor(queryClient: QueryClient) {
		super();
		this.queryClient = queryClient;
	}

	fetchQuery(options: any) {
		return this.queryClient.fetchQuery(options);
	}

	written = new Set();
	write(options: DehydratedState) {
		let data = { queries: [] as DehydratedState["queries"] };
		Object.values(options.queries).forEach((query) => {
			if (!this.written.has(query.queryHash)) {
				data.queries.push(query);
			}
			this.written.add(query.queryHash);
		});

		if (data.queries.length) {
			super.write(data);

			if (typeof window == "undefined") return;

			hydrate(this.queryClient, data, {});
		}
	}
}

export function CacheProvider({ children }: { children: any }) {
	const [queryClient] = useState(
		() =>
			new QueryClient({
				defaultOptions: {
					queries: {
						suspense: true,
						staleTime: Infinity,
					},
				},
			}),
	);

	const clientRef = useRef<any>();
	// const suspenseCacheRef = React.useRef<SuspenseCache>();

	if (typeof window !== "undefined") {
		clientRef.current = window[DataCacheSingleton] ??= new QueryCache(
			queryClient,
		);
		// suspenseCacheRef.current = window[SuspenseCacheSingleton] ??=
		//   makeSuspenseCache?.();
	} else {
		if (!clientRef.current) {
			clientRef.current = new QueryCache(queryClient);
		}
		// if (!suspenseCacheRef.current && makeSuspenseCache) {
		//   suspenseCacheRef.current = makeSuspenseCache();
		// }
	}

	if (typeof window === "undefined") {
		response().cache = clientRef.current;
	}

	return (
		<DataProvider cache={clientRef.current}>
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		</DataProvider>
	);
}
