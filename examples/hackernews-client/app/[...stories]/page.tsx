import { A } from "fully-react/link";
import { response } from "fully-react/request";
import { globalCache, useTransportValue } from "fully-react/cache";
import { PageConfig, PageProps } from "./page.types";
import Story from "components/story";
import fetchAPI from "~/api";
import { IStory } from "~/types";
import { use, useMemo } from "react";
import { dehydrate } from "@tanstack/react-query";
import { QueryCache } from "~/QueryCache";

export const config = {
	validateSearch: (searchParams) => {
		return { page: searchParams.page as number };
	},
} satisfies PageConfig;

const mapStories: Record<string, string> = {
	top: "news",
	new: "newest",
	show: "show",
	ask: "ask",
	job: "jobs",
};

function cache<Params extends any[], RType extends any>(
	fn: (...args: Params) => Promise<RType>,
): (...args: Params) => Promise<RType> {
	let name = fn.name || fn.toString();
	return async (...args) => {
		let res: QueryCache =
			typeof window === "undefined"
				? response().cache
				: (globalCache() as QueryCache);

		const defaultedOptions = res.queryClient.defaultQueryOptions({
			queryFn: () => fn(...args),
			queryKey: ["data", name, ...args],
		});

		// https://github.com/tannerlinsley/react-query/issues/652
		if (typeof defaultedOptions.retry === "undefined") {
			defaultedOptions.retry = false;
		}

		// @ts-expect-error
		const query = res.queryClient.queryCache.build(
			res.queryClient,
			defaultedOptions,
		);

		let data = await (query.isStaleByTime(defaultedOptions.staleTime)
			? query.fetch(defaultedOptions)
			: Promise.resolve(query.state.data));

		if (typeof window === "undefined") {
			res.write(dehydrate(res.queryClient));
		}
		return data as RType;
	};
}

const fetchStories = cache(async (type: string, page: number = 2000) => {
	let stories = await fetchAPI<IStory[]>(`${mapStories[type]}?page=${page}`);
	// await new Promise((resolve) => setTimeout(resolve, page));
	return stories;
});

function useCached<T>(promise: Promise<T>): T {
	let data = use(promise);
	useTransportValue({});
	return data;
}

// function Data({ delay }: { delay: number }) {
// 	const stories = useCached(useMemo(() => fetchStories("abc", delay), [delay]));
// 	return <pre>{JSON.stringify(stories)}</pre>;
// }

export function Stories({ searchParams, params }: PageProps) {
	let type =
		params["*"].length && mapStories[params["*"]] ? params["*"] : "top";
	let page = +searchParams.page || 1;

	const stories = useCached(
		useMemo(() => fetchStories(type, page), [type, page]),
	);

	if (!stories) {
		throw new Error("No stories found");
	}

	console.log({ page });

	return (
		<div className="news-view">
			<div className="news-list-nav">
				{page > 1 ? (
					<A
						className="page-link"
						href={`/${type}?page=${page - 1}`}
						aria-label="Previous Page"
					>
						{"<"} prev
					</A>
				) : (
					<span className="page-link disabled" aria-disabled="true">
						{"<"} prev
					</span>
				)}

				<span>page {page}</span>
				{stories.length >= 29 ? (
					<A
						className="page-link"
						href={`/${type}?page=${page + 1}`}
						aria-label="Next Page"
					>
						more {">"}
					</A>
				) : (
					<span className="page-link disabled" aria-disabled="true">
						more {">"}
					</span>
				)}
			</div>
			<main className="news-list">
				<ul>
					{stories.map((story) => (
						<Story story={story} key={story.id} />
					))}
				</ul>
			</main>
			{/* <Suspense fallback={<div>Loading...</div>}>
				<Data delay={4000} />
			</Suspense> */}
		</div>
	);
}

export default function Page(props) {
	return (
		<>
			<Stories {...props} />
			{/* <Suspense fallback={<div>Loading...</div>}>
				<Data delay={3001} />
			</Suspense>
			<Suspense fallback={<div>Loading...</div>}>
				<Data delay={3000} />
			</Suspense> */}
		</>
	);
}
