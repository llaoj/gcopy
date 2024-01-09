import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { SessionData, sessionOptions } from "@/lib/session";
import { z } from "zod";
import { NextRequest } from "next/server";
import nodemailer from "nodemailer";
import SMTPTransport from "nodemailer/lib/smtp-transport";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { email: string };

  const validatedFields = z
    .object({
      email: z.string().email({ message: "Invalid email" }),
    })
    .safeParse({
      email: body.email,
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

  // send email code
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: true,
    auth: {
      user: process.env.SMTP_USERNAME,
      pass: process.env.SMTP_PASSWORD,
    },
  } as SMTPTransport.Options);
  const code = Math.random().toString().substring(2, 8);
  try {
    await transporter.sendMail({
      from: {
        name: "GCopy",
        address: process.env.SMTP_SENDER || "",
      },
      to: validatedFields.data.email,
      subject: code + " is your verification code",
      text:
        "Enter the verification code when prompted: " +
        code +
        ". Code will expire in 5 minutes. To protect your account, do not share this code.",
      html:
        "<p>Enter the following verification code when prompted:<br/>" +
        code +
        "<br/>Code will expire in 5 minutes.<br/>To protect your account, do not share this code.</p>",
    });
  } catch {
    return Response.json(
      { message: "Failed to send email. Please check and retry." },
      { status: 500 },
    );
  }

  const session = await getIronSession<SessionData>(cookies(), sessionOptions);
  session.email = validatedFields.data.email;
  session.emailCode = code;
  session.createdTime = Date.now();
  await session.save();

  return Response.json({ message: "success" });
}
