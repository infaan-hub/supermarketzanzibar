"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/auth/auth-provider";
import {
  defaultHomeForRole,
  portalHref,
  roleLabel,
} from "@/lib/auth/roles";

export default function UnauthorizedPage() {
  const { user, logout } = useAuth();
  const homeHref = user ? defaultHomeForRole(user.role) : "/";
  const profileHref = user ? portalHref(user.role, "/profile") : "/login";

  return (
    <div className="flex min-h-[78vh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-lg border border-border bg-white p-7 text-center shadow-card">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-md border border-danger/25 bg-danger-soft text-sm font-semibold text-danger tabular-nums">
          403
        </div>
        <h1 className="mt-4 text-lg font-semibold text-foreground">
          Access restricted
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          Your current account role does not have permission to open this page.
        </p>
        {user && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-md border border-border bg-surface-subtle px-3 py-1.5 text-xs">
            <span className="text-muted">Signed in as</span>
            <span className="font-medium text-foreground">{user.username}</span>
            <Badge variant="secondary">{roleLabel(user.role)}</Badge>
          </div>
        )}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Link href={homeHref}>
            <Button size="md">Go to workspace</Button>
          </Link>
          {user && (
            <Link href={profileHref}>
              <Button variant="secondary" size="md">
                My profile
              </Button>
            </Link>
          )}
          <Button variant="ghost" size="md" onClick={() => void logout()}>
            Switch account
          </Button>
        </div>
      </div>
    </div>
  );
}
