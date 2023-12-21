import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions } from "@/lib/session";
import { SessionData } from "@/lib/session";
import { z } from "zod";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    email: string;
    code: string;
  };
  const validatedFields = z
    .object({
      email: z.string().email({ message: "Invalid email" }),
      code: z
        .string()
        .regex(new RegExp("[0-9]{6}"), { message: "Incorrect code" }),
    })
    .safeParse({
      email: body.email,
      code: body.code,
    });
  if (!validatedFields.success) {
    return Response.json(
      {
        message: validatedFields.error.issues
          .map((issue) => issue.message)
          .join(" "),
      },
      { status: 422 },
    );
  }

  const session = await getIronSession<SessionData>(cookies(), sessionOptions);
  if (session.isLoggedIn) {
    return Response.json({ email: validatedFields.data.email });
  }

  if (validatedFields.data.code == session.emailCode) {
    if (Date.now() - session.createdTime > 5 * 60 * 1000) {
      return Response.json(
        { email: "The code was expired. Please go back and retry." },
        { status: 422 },
      );
    }
    session.isLoggedIn = true;
    await session.save();
    return Response.json({
      message: "success",
      data: {
        email: validatedFields.data.email,
      },
    });
  }

  return Response.json(
    { message: "Incorrect code. Please go back and retry." },
    { status: 401 },
  );
}
