import { useTransportValue } from "fully-react/cache";
import { useContext } from "react";
import {
	QueryOptions,
	dehydrate,
	useQuery as useBaseQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { CacheContext } from "fully-react/cache";

export function useQuery(options: QueryOptions) {
	const dataCache = useContext(CacheContext);
	const queryClient = useQueryClient();
	let query = useBaseQuery(options);

	if (query.status === "success" && typeof window == "undefined") {
		dataCache!.write(dehydrate(queryClient));
	}

	useTransportValue({
		status: query.status,
	});
	return query;
}
