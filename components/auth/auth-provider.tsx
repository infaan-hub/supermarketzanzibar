"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import type { AuthUser } from "@/types/api";
import {
  AUTH_CHANGE_EVENT,
  clearAccessToken,
  getAccessToken,
  setAccessToken,
} from "@/lib/auth/client";
import {
  adminCanonicalRedirect,
  canAccessPath,
  isAdminRole,
  isPublicPath,
} from "@/lib/auth/roles";
import {
  fetchMe,
  logoutRequest,
  refreshAccessToken,
} from "@/lib/api";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  setSession: (accessToken: string, user: AuthUser) => void;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [loading, setLoading] = React.useState(true);

  const hydrate = React.useCallback(async () => {
    try {
      const existingToken = getAccessToken();
      if (!existingToken) {
        const refreshed = await refreshAccessToken();
        if (!refreshed?.access) {
          setUser(null);
          return;
        }
        if (refreshed.user) {
          setUser(refreshed.user);
          return;
        }
      }

      const { user: me } = await fetchMe();
      setUser(me);
    } catch {
      clearAccessToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void hydrate();
  }, [hydrate]);

  React.useEffect(() => {
    const syncOnStorage = () => {
      if (!getAccessToken()) {
        setUser(null);
      }
    };
    window.addEventListener("storage", syncOnStorage);
    window.addEventListener(AUTH_CHANGE_EVENT, syncOnStorage);
    return () => {
      window.removeEventListener("storage", syncOnStorage);
      window.removeEventListener(AUTH_CHANGE_EVENT, syncOnStorage);
    };
  }, []);

  React.useEffect(() => {
    if (loading) return;
    if (isPublicPath(pathname)) return;

    if (!user) {
      const nextParam =
        pathname && pathname !== "/"
          ? `?next=${encodeURIComponent(pathname)}`
          : "";
      router.replace(`/login${nextParam}`);
      return;
    }

    // Keep all Admin pages strictly under `/admin/*` (preserving query params).
    if (isAdminRole(user.role)) {
      const adminTarget = adminCanonicalRedirect(pathname);
      if (adminTarget) {
        const search =
          typeof window !== "undefined" ? window.location.search : "";
        router.replace(`${adminTarget}${search}`);
        return;
      }
    }

    if (!canAccessPath(user.role, pathname)) {
      router.replace("/unauthorized");
    }
  }, [loading, pathname, router, user]);

  const setSession = React.useCallback((accessToken: string, nextUser: AuthUser) => {
    setAccessToken(accessToken);
    setUser(nextUser);
    setLoading(false);
  }, []);

  const refreshUser = React.useCallback(async () => {
    try {
      const { user: me } = await fetchMe();
      setUser(me);
    } catch {
      clearAccessToken();
      setUser(null);
    }
  }, []);

  const logout = React.useCallback(async () => {
    await logoutRequest();
    setUser(null);
    router.replace("/login");
  }, [router]);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      setSession,
      refreshUser,
      logout,
    }),
    [user, loading, setSession, refreshUser, logout],
  );

  // Prevent flashing protected UI while checking auth or redirecting.
  const waitingForGuard =
    !isPublicPath(pathname) &&
    (loading ||
      !user ||
      !canAccessPath(user.role, pathname) ||
      (isAdminRole(user.role) && adminCanonicalRedirect(pathname) !== null));

  return (
    <AuthContext.Provider value={value}>
      {waitingForGuard ? (
        <div className="flex min-h-dvh items-center justify-center bg-canvas px-4">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-sm font-semibold text-white">
              SZ
            </div>
            <p className="text-xs font-medium text-muted">
              Verifying session…
            </p>
          </div>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider />.");
  }
  return ctx;
}
