import { useSWRConfig } from "swr";
import useSWR from "swr";

interface User {
  userId?: string;
  authMode?: "email" | "token";
  loggedIn: boolean;
}

const defaultUser: User = {
  userId: "",
  authMode: undefined,
  loggedIn: false,
};

const userApiRoute = "/api/v1/user";

async function fetcher<JSON>(url: string): Promise<JSON> {
  return fetch(url, {
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
  }).then((res) => res.json());
}

export default function useAuth() {
  const { data, isLoading } = useSWR(userApiRoute, fetcher<User>, {
    fallbackData: defaultUser,
  });
  const userId = data.userId;
  const authMode = data.authMode;
  const loggedIn = data.loggedIn;
  const { mutate } = useSWRConfig();

  const logout = async () => {
    const response = await fetch("/api/v1/user/logout", {
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
    });
    if (response.status == 200) {
      mutate(userApiRoute, defaultUser);
    }
  };

  return { isLoading, userId, authMode, loggedIn, logout };
}
