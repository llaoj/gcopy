import useSWR from "swr";
// import { SessionData } from "@/lib/session";
import useSWRMutation from "swr/mutation";
import { UserInfo, defaultUserInfo } from "./types";

const sessionApiRoute = "/api/session";

async function fetchJson<JSON = unknown>(
  input: RequestInfo,
  init?: RequestInit,
): Promise<JSON> {
  return fetch(input, {
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    ...init,
  }).then((res) => res.json());
}

// function doLogin(url: string, { arg }: { arg: string }) {
//     return fetchJson<SessionData>(url, {
//         method: "POST",
//         body: JSON.stringify({ username: arg }),
//     });
// }

function doLogout(url: string) {
  return fetchJson<UserInfo>(url, {
    method: "DELETE",
  });
}

export default function useSession() {
  const { data: session, isLoading } = useSWR(
    sessionApiRoute,
    fetchJson<UserInfo>,
    {
      fallbackData: defaultUserInfo,
    },
  );

  // const { trigger: login } = useSWRMutation(sessionApiRoute, doLogin, {
  //     // the login route already provides the updated information, no need to revalidate
  //     revalidate: false,
  // });

  const { trigger: logout } = useSWRMutation(sessionApiRoute, doLogout);

  //return { session, logout, login, isLoading };
  return { session, logout, isLoading };
}
