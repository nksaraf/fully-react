import { useQuery } from "@tanstack/react-query";
import { PageProps } from "./page.types";
import fetchAPI from "~/api";

export default function UserPage({ params }: PageProps) {
	let { data: user } = useQuery({
		queryFn: () => fetchAPI<IUser>(`user/${params.id}`),
		queryKey: ["user", params.id],
	});

	if (!user || user.error) {
		return <div>User not found</div>;
	}

	return (
		<div className="user-view">
			<h1>User : {user!.id}</h1>
			<ul className="meta">
				<li>
					<span className="label">Created:</span> {user!.created}
				</li>
				<li>
					<span className="label">Karma:</span> {user!.karma}
				</li>
				{user!.about ? (
					<li
						dangerouslySetInnerHTML={{ __html: user!.about }}
						className="about"
					/>
				) : null}
			</ul>
			<p className="links">
				<a href={`https://news.ycombinator.com/submitted?id=${user!.id}`}>
					submissions
				</a>{" "}
				|{" "}
				<a href={`https://news.ycombinator.com/threads?id=${user!.id}`}>
					comments
				</a>
			</p>
		</div>
	);
}

interface IUser {
	error: string;
	id: string;
	created: string;
	karma: number;
	about: string;
}
