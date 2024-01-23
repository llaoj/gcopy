import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { SessionData, sessionOptions } from "@/lib/session";
import { z } from "zod";
import { getAcceptLanguageLocale } from "@/lib/i18n";
import { getTranslations } from "next-intl/server";

export async function POST(request: Request) {
  const locale = getAcceptLanguageLocale(request.headers);
  const t = await getTranslations({ locale, namespace: "Login" });
  const body = (await request.json()) as {
    email: string;
    code: string;
  };
  const validatedFields = z
    .object({
      email: z.string().email({ message: t("invalidEmail") }),
      code: z
        .string()
        .regex(new RegExp("[0-9]{6}"), { message: t("incorrectCode") }),
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
      return Response.json({ message: t("expiredCode") }, { status: 422 });
    }
    session.isLoggedIn = true;
    await session.save();
    return Response.json({
      message: t("success"),
      data: {
        email: validatedFields.data.email,
      },
    });
  }

  return Response.json({ message: t("incorrectCode") }, { status: 401 });
}
