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
    <div className="flex min-h-[78vh] items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md rounded-3xl text-center shadow-soft">
        <CardHeader className="space-y-3 pb-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-red-200 bg-red-50 font-display text-lg font-bold text-danger shadow-sm">
            403
          </div>
          <CardTitle className="text-2xl">Access restricted</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-muted">
            Your current account role does not have permission to open this page.
          </p>
          {user && (
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-subtle px-3.5 py-1.5 text-xs">
              <span className="text-muted">Signed in as</span>
              <span className="font-semibold text-foreground">
                {user.username}
              </span>
              <Badge variant="secondary">{roleLabel(user.role)}</Badge>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <Link href={homeHref}>
              <Button size="md">Go to My Portal</Button>
            </Link>
            {user && (
              <Link href={profileHref}>
                <Button variant="secondary" size="md">
                  My Profile
                </Button>
              </Link>
            )}
            <Button variant="ghost" size="md" onClick={() => void logout()}>
              Switch account
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
