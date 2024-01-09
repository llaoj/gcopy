// import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { SessionData, sessionOptions } from "@/lib/session";
import { UserInfo, defaultUserInfo } from "@/lib/types";

// login
// export async function POST(request: NextRequest) {
//     const session = await getIronSession<SessionData>(cookies(), sessionOptions);

//     const { username = "No username" } = (await request.json()) as {
//         username: string;
//     };

//     session.isLoggedIn = true;
//     session.username = username;
//     await session.save();

//     // simulate looking up the user in db
//     await sleep(250);

//     return Response.json(session);
// }

// read session
export async function GET() {
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);

  // simulate looking up the user in db
  // await sleep(250);

  if (session.isLoggedIn !== true) {
    return Response.json({ defaultUserInfo });
  }

  return Response.json({
    email: session.email,
    isLoggedIn: session.isLoggedIn,
  } as UserInfo);
}

// logout
export async function DELETE() {
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);

  session.destroy();

  return Response.json(defaultUserInfo);
}
