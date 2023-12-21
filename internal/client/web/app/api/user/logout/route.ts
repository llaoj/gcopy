import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { defaultSession, sessionOptions } from "@/lib/session";
import { SessionData } from "@/lib/session";

export async function GET() {
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);
  session.destroy();
  return Response.json(defaultSession);
}
