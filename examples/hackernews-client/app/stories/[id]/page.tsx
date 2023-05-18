import { A } from "fully-react/link";
import Comment from "components/comment";
import { IStory } from "~/types";
import { PageProps } from "./page.types";
import fetchAPI from "~/api";
import { useQuery } from "@tanstack/react-query";

export default function StoryPage({ params }: PageProps) {
	const { data: story } = useQuery({
		queryFn: () => fetchAPI<IStory>(`item/${params.id}`),
		queryKey: ["story", params.id],
	});

	if (!story) {
		return <div>Story not found</div>;
	}

	return (
		<div className="item-view">
			<div className="item-view-header">
				<a href={story.url} target="_blank">
					<h1>{story.title}</h1>
				</a>
				{story.domain ? <span className="host">({story.domain})</span> : null}
				<p className="meta">
					{story.points} points | by{" "}
					<A href={`/users/${story.user}`}>{story.user}</A> {story.time_ago} ago
				</p>
			</div>
			<div className="item-view-comments">
				<p className="item-view-comments-header">
					{story.comments_count
						? story.comments_count + " comments"
						: "No comments yet."}
				</p>
				<ul className="comment-children">
					{story.comments.map((comment) => (
						<Comment comment={comment} />
					))}
				</ul>
			</div>
		</div>
	);
}
