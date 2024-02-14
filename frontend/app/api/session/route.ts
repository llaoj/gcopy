import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { SessionData, sessionOptions } from "@/lib/session";
import { UserInfo, defaultUserInfo } from "@/lib/user";

export async function GET() {
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);

  if (session.isLoggedIn !== true) {
    return Response.json({ defaultUserInfo });
  }

  return Response.json({
    email: session.email,
    isLoggedIn: session.isLoggedIn,
  } as UserInfo);
}

export async function DELETE() {
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);
  session.destroy();
  return Response.json(defaultUserInfo);
}
