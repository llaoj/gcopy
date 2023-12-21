import { SessionOptions } from "iron-session";

export interface SessionData {
  email: string;
  emailCode: string;
  createdTime: number;
  isLoggedIn: boolean;
}

export const defaultSession: SessionData = {
  email: "",
  emailCode: "",
  createdTime: 0,
  isLoggedIn: false,
};

export const sessionOptions: SessionOptions = {
  password: process.env.IRON_SESSION_PASSWORD || "iron-session-password",
  cookieName: "gcopy",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
  },
};
