import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions } from "@/lib/session";
import { SessionData } from "@/lib/session";

export async function GET() {
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);
  if (!session.isLoggedIn) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }
  return Response.json({
    message: "success",
    data: {
      email: session.email,
    },
  });
}
