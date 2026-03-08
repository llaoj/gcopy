/**
 * Get the login path based on authentication mode
 * @param authMode - The authentication mode ("token" or "email")
 * @param locale - The current locale
 * @returns The login page path
 */
export function getLoginPath(authMode: string, locale: string): string {
  if (authMode === "token") {
    return `/${locale}/user/token`;
  }
  if (authMode === "email") {
    return `/${locale}/user/email`;
  }
  return "#";
}

/**
 * Redirect to the appropriate login page based on authentication mode
 * @param router - Next.js router instance
 * @param authMode - The authentication mode ("token" or "email")
 * @param locale - The current locale
 */
export function redirectToLogin(
  router: { push: (url: string) => void },
  authMode: string,
  locale: string
): void {
  const path = getLoginPath(authMode, locale);
  if (path !== "#") {
    router.push(path);
  }
}
