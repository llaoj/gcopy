export function getLoginPath(authMode: string): string {
  if (authMode === "token") {
    return "/user/token";
  }
  if (authMode === "email") {
    return "/user/email";
  }
  return "#";
}

export function redirectToLogin(
  router: { push: (url: string) => void },
  authMode: string,
): void {
  const path = getLoginPath(authMode);
  if (path !== "#") {
    router.push(path);
  }
}
