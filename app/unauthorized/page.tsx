"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div className="flex min-h-[75vh] items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-danger-soft text-danger font-display text-lg font-bold">
            403
          </div>
          <CardTitle className="text-2xl">Access restricted</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted">
            Your account does not have permission to open this screen.
          </p>
          {user && (
            <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-subtle px-3 py-1.5 text-xs">
              <span className="text-muted">Signed in as</span>
              <span className="font-semibold text-foreground">
                {user.username}
              </span>
              <Badge variant="secondary">{roleLabel(user.role)}</Badge>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <Link
              href={homeHref}
              className="inline-flex h-10 items-center justify-center rounded bg-primary-hover px-4 text-sm font-medium text-white shadow-sm hover:bg-[#0f5c23]"
            >
              Go to My Portal
            </Link>
            {user && (
              <Link
                href={profileHref}
                className="inline-flex h-10 items-center justify-center rounded border border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-accent/5"
              >
                My Profile
              </Link>
            )}
            <Button variant="secondary" onClick={() => void logout()}>
              Switch account
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
