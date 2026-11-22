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
    <div className="flex min-h-[86vh] items-center justify-center py-8">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl border border-border bg-white/95 shadow-soft backdrop-blur-md lg:grid-cols-[1.05fr_1fr]">
        {/* Brand Showcase Panel */}
        <div className="hidden flex-col justify-between bg-gradient-to-br from-teal-700 via-teal-800 to-[#0c4a52] p-8 text-white lg:flex">
          <div className="space-y-6">
            <Link href="/" className="inline-flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 font-display text-sm font-bold text-white ring-1 ring-white/25 backdrop-blur">
                SZ
              </div>
              <div>
                <p className="font-display text-base font-bold leading-tight">
                  Supermarket Zanzibar
                </p>
                <p className="text-[11px] text-teal-100/80">
                  3D Digital Twin · POS · Inventory
                </p>
              </div>
            </Link>

            <div className="space-y-3 pt-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-200">
                Unified Retail Platform
              </p>
              <h2 className="font-display text-3xl font-bold leading-tight">
                Real-time store operations connected in 3D.
              </h2>
              <p className="text-sm leading-relaxed text-teal-100/85">
                Sign in to access your role-specific workspace—automatically
                routed to Admin, MarketMaster, Store Staff, or Supplier portals.
              </p>
            </div>
          </div>

          <div className="space-y-2.5 rounded-2xl bg-white/10 p-4 text-xs ring-1 ring-white/15 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white">Admin Portal</span>
              <code className="rounded bg-white/15 px-2 py-0.5 text-[11px] text-teal-100">
                /admin/*
              </code>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white">MarketMaster</span>
              <code className="rounded bg-white/15 px-2 py-0.5 text-[11px] text-teal-100">
                /dashboard
              </code>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white">Supplier Portal</span>
              <code className="rounded bg-white/15 px-2 py-0.5 text-[11px] text-teal-100">
                /supplier/*
              </code>
            </div>
          </div>
        </div>

        {/* Sign-in Form */}
        <Card className="rounded-none border-0 shadow-none">
          <CardHeader className="space-y-2 p-7 pb-4 sm:p-8 sm:pb-4">
            <div className="flex items-center gap-3 lg:hidden">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 font-display text-sm font-bold text-white shadow-sm">
                SZ
              </div>
              <div>
                <p className="font-display text-base font-bold text-foreground">
                  Supermarket Zanzibar
                </p>
                <p className="text-xs text-muted">POS &amp; 3D Digital Twin</p>
              </div>
            </div>
            <CardTitle className="text-2xl">Welcome back</CardTitle>
            <CardDescription>
              Sign in with your username or email to open your workspace.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-7 pt-2 sm:p-8 sm:pt-2">
            {needsAdmin && (
              <div className="mb-5 rounded-2xl border border-teal-200 bg-surface-subtle p-3.5 text-sm">
                <p className="font-display font-semibold text-teal-900">
                  First-time setup detected
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  No administrator exists yet.{" "}
                  <Link
                    href="/register"
                    className="font-semibold text-teal-700 underline"
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
                  className="rounded-xl border border-danger/25 bg-red-50 px-3.5 py-2.5 text-sm text-danger"
                >
                  {error}
                </div>
              )}
              <div className="space-y-1.5">
                <label
                  htmlFor="username"
                  className="text-xs font-semibold uppercase tracking-wider text-muted"
                >
                  Username or email
                </label>
                <Input
                  id="username"
                  name="username"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username or email"
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="password"
                  className="text-xs font-semibold uppercase tracking-wider text-muted"
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
                  placeholder="••••••••"
                  required
                />
              </div>
              <Button
                type="submit"
                size="lg"
                className="mt-2 w-full"
                isLoading={loading}
              >
                Sign in
              </Button>
              <p className="pt-2 text-center text-xs text-muted">
                Need an account?{" "}
                <Link
                  href="/register"
                  className="font-semibold text-teal-700 hover:underline"
                >
                  Register
                </Link>
                {" · "}
                <Link
                  href="/"
                  className="font-semibold text-teal-700 hover:underline"
                >
                  Browse Storefront
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
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
