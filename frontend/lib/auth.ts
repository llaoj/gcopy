import { useSWRConfig } from "swr";
import useSWR from "swr";

interface User {
  userId?: string;
  loggedIn: boolean;
}

const defaultUser: User = {
  userId: "",
  loggedIn: false,
};

const userApiRoute = "/api/v1/user";

async function fetcher<JSON>(url: string): Promise<JSON> {
  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
    });
    return response.json();
  } catch (error) {
    // iOS Safari may block requests during downloads or heavy network activity
    // Return default user instead of throwing to prevent UI errors
    console.warn("Auth fetch blocked, likely due to iOS Safari network policy:", error);
    return defaultUser as JSON;
  }
}

export default function useAuth() {
  const { data, isLoading } = useSWR(userApiRoute, fetcher<User>, {
    fallbackData: defaultUser,
    revalidateOnFocus: false, // Reduce unnecessary revalidation on iOS Safari
    revalidateOnReconnect: false, // Reduce network requests
    shouldRetryOnError: false, // Don't retry on iOS Safari network blocks
  });
  const userId = data.userId;
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

  return { isLoading, userId, loggedIn, logout };
}
