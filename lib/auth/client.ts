// Client-side access-token helpers and same-tab auth change notifications.
//
// Tokens are verified server-side on every request; decoded claims here are
// used only for UX hints (greetings, expiry checks before refresh).

export const ACCESS_TOKEN_KEY = "ss_access_token";
export const AUTH_CHANGE_EVENT = "sz-auth-change";

export interface AccessTokenClaims {
  sub?: string;
  username?: string;
  role?: string;
  token_type?: string;
  exp?: number;
}

function decodeBase64Url(segment: string): string {
  const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "=",
  );
  const binary = window.atob(padded);
  const bytes = Uint8Array.from(binary, (character) =>
    character.charCodeAt(0),
  );
  return new TextDecoder().decode(bytes);
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAccessToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
    window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
  } catch {
    // ignore storage quota/privacy mode errors
  }
}

export function clearAccessToken(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
  } catch {
    // ignore
  }
}

export function readAccessTokenClaims(): AccessTokenClaims | null {
  const token = getAccessToken();
  if (!token) return null;

  const segments = token.split(".");
  if (segments.length !== 3) return null;

  try {
    const claims = JSON.parse(decodeBase64Url(segments[1])) as unknown;
    if (typeof claims !== "object" || claims === null) return null;

    const parsed = claims as AccessTokenClaims;
    if (
      parsed.token_type !== undefined &&
      parsed.token_type !== "access"
    ) {
      return null;
    }
    if (typeof parsed.exp === "number" && parsed.exp * 1000 <= Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function readWelcomeName(): string | null {
  const username = readAccessTokenClaims()?.username?.trim();
  if (!username) return null;
  return username.charAt(0).toUpperCase() + username.slice(1);
}
