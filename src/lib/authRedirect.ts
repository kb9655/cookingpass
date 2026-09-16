const AUTH_RETURN_TO_KEY = "cookingpass:auth-return-to";

export function normalizeAuthReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  if (value.startsWith("/login") || value.startsWith("/auth/callback")) return "/";
  return value;
}

export function saveAuthReturnTo(value: string): void {
  sessionStorage.setItem(AUTH_RETURN_TO_KEY, normalizeAuthReturnTo(value));
}

export function consumeAuthReturnTo(): string {
  const value = sessionStorage.getItem(AUTH_RETURN_TO_KEY);
  sessionStorage.removeItem(AUTH_RETURN_TO_KEY);
  return normalizeAuthReturnTo(value);
}
