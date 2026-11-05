// Client-only access-token helpers.
//
// The login page stores the access token in localStorage and the rest of the
// app does not currently send it to API routes. This module decodes the token
// only to personalise the dashboard greeting. It must never be used as proof
// of identity or authorization: the signature is not verified here.

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

export function readAccessTokenClaims(): AccessTokenClaims | null {
  if (typeof window === "undefined") return null;

  let token: string | null = null;
  try {
    token = window.localStorage.getItem("ss_access_token");
  } catch {
    return null;
  }
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

/** A friendly first name for the greeting, e.g. "infaan" -> "Infaan". */
export function readWelcomeName(): string | null {
  const username = readAccessTokenClaims()?.username?.trim();
  if (!username) return null;
  return username.charAt(0).toUpperCase() + username.slice(1);
}
