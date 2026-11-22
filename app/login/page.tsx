"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-provider";
import { fetchBootstrap, loginRequest } from "@/lib/api";
import {
  canAccessPath,
  defaultHomeForRole,
  portalHref,
} from "@/lib/auth/roles";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setSession, user } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [needsAdmin, setNeedsAdmin] = useState(false);

  const rawNext = searchParams.get("next") || "";
  const safeNext =
    rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "";

  function resolveLanding(role: string): string {
    if (safeNext) {
      const rolePath = portalHref(role, safeNext);
      if (canAccessPath(role, rolePath)) return rolePath;
      if (canAccessPath(role, safeNext)) return safeNext;
    }
    return defaultHomeForRole(role);
  }

  useEffect(() => {
    if (user) {
      router.replace(resolveLanding(user.role));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, safeNext, user]);

  useEffect(() => {
    fetchBootstrap()
      .then((res) => setNeedsAdmin(!res.hasAdmin))
      .catch(() => undefined);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !password) {
      setError("Enter both username (or email) and password.");
      return;
    }

    setLoading(true);
    try {
      const data = await loginRequest(username.trim(), password);
      setSession(data.access, data.user);
      router.replace(resolveLanding(data.user.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid credentials.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[84vh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-[380px] space-y-6">
        <div className="space-y-3 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 text-foreground"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-xs font-semibold text-white">
              SZ
            </span>
            <span className="text-base font-semibold tracking-tight">
              Supermarket Zanzibar
            </span>
          </Link>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Sign in to your account
            </h1>
            <p className="text-sm text-muted">
              Enter your staff or partner credentials to continue.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-white p-6 shadow-card">
          {needsAdmin && (
            <div className="mb-4 rounded-md border border-primary/25 bg-primary-soft p-3 text-xs">
              <p className="font-semibold text-foreground">
                First-time store setup
              </p>
              <p className="mt-0.5 text-muted">
                No administrator exists yet.{" "}
                <Link
                  href="/register"
                  className="font-medium text-primary underline"
                >
                  Create the first admin account
                </Link>
                .
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {error && (
              <div
                role="alert"
                className="rounded-md border border-danger/25 bg-danger-soft px-3 py-2 text-xs text-danger"
              >
                {error}
              </div>
            )}
            <div className="space-y-1.5">
              <label
                htmlFor="username"
                className="text-xs font-medium text-foreground"
              >
                Username or email
              </label>
              <Input
                id="username"
                name="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="name@example.com"
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="text-xs font-medium text-foreground"
              >
                Password
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
              />
            </div>
            <Button
              type="submit"
              size="lg"
              className="w-full"
              isLoading={loading}
            >
              Sign in
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-muted">
          <Link href="/register" className="font-medium text-foreground hover:text-primary hover:underline">
            Create an account
          </Link>
          <span className="mx-2 text-border-hover">·</span>
          <Link href="/" className="font-medium text-foreground hover:text-primary hover:underline">
            Back to store
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
