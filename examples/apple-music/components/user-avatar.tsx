import * as React from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { DemoIndicator } from "../app/apple-music-demo";
import { SignInButton } from "rsc-auth/components";
import { UserDropdownMenu } from "@/components/user-menu";
import { authOptions } from "@/lib/auth";
import { buttonVariants } from "@/components/ui/button";
import { getSession } from "rsc-auth";
import { request } from "fully-react/request";

export async function UserAvatar() {
	let user = await getSession(request(), authOptions);
	if (!user)
		return (
			<div className="ml-auto mr-4">
				<SignInButton
					className={buttonVariants({
						variant: "ghost",
					})}
				>
					Sign In
				</SignInButton>
			</div>
		);

	return (
		<>
			<div className="ml-auto mr-4">
				<h3 className="text-sm font-semibold">
					Welcome {user.user?.name?.split(" ")[0]}!
				</h3>
			</div>
			<UserDropdownMenu user={user}>
				<Avatar>
					<AvatarImage src={user.user?.image!} alt="@shadcn" />
					<AvatarFallback>
						{user.user
							?.name!.split(" ")
							.map((a) => a.charAt(0))
							.join("")}
					</AvatarFallback>
				</Avatar>
				<DemoIndicator className="right-0 top-0" />
			</UserDropdownMenu>
		</>
	);
}
