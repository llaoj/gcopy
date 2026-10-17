export function getLoginPath(): string {
  return "/user/token";
}

export function redirectToLogin(router: { push: (url: string) => void }): void {
  router.push(getLoginPath());
}
