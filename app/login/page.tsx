"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/components/auth/auth-provider";
import { fetchBootstrap, loginRequest } from "@/lib/api";
import { canAccessPath } from "@/lib/auth/roles";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setSession, user } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [needsAdmin, setNeedsAdmin] = useState(false);

  const rawNext = searchParams.get("next") || "/";
  const safeNext =
    rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  useEffect(() => {
    if (user) {
      router.replace(canAccessPath(user.role, safeNext) ? safeNext : "/profile");
    }
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
      const target = canAccessPath(data.user.role, safeNext)
        ? safeNext
        : canAccessPath(data.user.role, "/")
          ? "/"
          : "/unauthorized";
      router.replace(target);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid credentials.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-hover font-display text-sm font-bold text-white shadow-[0_0_14px_rgba(21,114,45,0.28)]">
              SZ
            </div>
            <div>
              <CardTitle className="text-2xl">Sign in</CardTitle>
              <CardDescription>
                Supermarket Zanzibar POS &amp; Inventory
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {needsAdmin && (
            <div className="mb-4 rounded-lg border border-primary/30 bg-surface-subtle p-3 text-sm text-foreground">
              <p className="font-medium text-primary-hover">
                First-time setup detected
              </p>
              <p className="mt-0.5 text-xs text-muted">
                No administrator exists yet.{" "}
                <Link
                  href="/register"
                  className="font-semibold text-primary underline"
                >
                  Create the first admin account
                </Link>{" "}
                to get started.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {error && (
              <div
                role="alert"
                className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger"
              >
                {error}
              </div>
            )}
            <div className="space-y-1.5">
              <label
                htmlFor="username"
                className="text-sm font-medium text-foreground"
              >
                Username or email
              </label>
              <Input
                id="username"
                name="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="text-sm font-medium text-foreground"
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
                required
              />
            </div>
            <Button type="submit" className="w-full" isLoading={loading}>
              Sign in
            </Button>
            <p className="text-center text-sm text-muted">
              Need an account?{" "}
              <Link
                href="/register"
                className="font-medium text-primary hover:underline"
              >
                Register
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
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
