// Users & RBAC management page (`/users`, admin only).

"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";
import { SkeletonText } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useUsers } from "@/hooks/useUsers";
import { useAuth } from "@/components/auth/auth-provider";
import { createUser, updateUser } from "@/lib/api";
import {
  ALL_ROLES,
  normalizeRole,
  roleDescription,
  roleLabel,
} from "@/lib/auth/roles";
import { formatDate } from "@/lib/format";

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const { data, loading, error, refresh } = useUsers({
    search: search.trim() || undefined,
    role: roleFilter || undefined,
  });

  const [showCreate, setShowCreate] = useState(false);
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("manager");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const openCreateWithRole = (targetRole: string) => {
    setRole(targetRole);
    setFormError(null);
    setNotice(null);
    setShowCreate(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    setFormError(null);
    setNotice(null);
    try {
      await createUser({
        username: username.trim(),
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        role,
        password,
        companyName: role === "supplier" ? companyName.trim() : undefined,
      });
      setUsername("");
      setFullName("");
      setEmail("");
      setPhone("");
      setPassword("");
      setCompanyName("");
      setShowCreate(false);
      setNotice(`${roleLabel(role)} account created.`);
      refresh();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Unable to create user.",
      );
    } finally {
      setCreating(false);
    }
  };

  const handleRoleUpdate = async (userId: string, nextRole: string) => {
    setBusyId(userId);
    setNotice(null);
    setFormError(null);
    try {
      await updateUser(userId, { role: nextRole });
      setNotice("User role updated.");
      refresh();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Unable to update role.",
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleActive = async (userId: string, currentActive: boolean) => {
    setBusyId(userId);
    setNotice(null);
    setFormError(null);
    try {
      await updateUser(userId, { is_active: !currentActive });
      setNotice(currentActive ? "Account disabled." : "Account activated.");
      refresh();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Unable to update account status.",
      );
    } finally {
      setBusyId(null);
    }
  };

  if (loading && !data) {
    return (
      <div className="mx-auto max-w-[1400px] space-y-6">
        <SkeletonText lines={2} className="w-[40%]" />
        <div className="h-80 rounded-lg border border-border bg-background p-6">
          <SkeletonText lines={5} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-[1400px] space-y-6">
        <h1 className="font-display text-2xl font-bold text-foreground">
          Users
        </h1>
        <EmptyState
          title="Unable to load users"
          description={error.message}
          action={
            <Button variant="secondary" onClick={refresh}>
              Try again
            </Button>
          }
        />
      </div>
    );
  }

  const users = data?.users ?? [];

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        title="Users & Permissions"
        description="Register Manager, MarketMaster, supplier, and other accounts, assign roles, and manage access."
        actions={
          <div className="flex flex-wrap gap-2">
            {!showCreate && (
              <>
                <Button
                  size="sm"
                  onClick={() => openCreateWithRole("manager")}
                >
                  + Register Manager
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => openCreateWithRole("marketmaster")}
                >
                  + Register MarketMaster
                </Button>
              </>
            )}
            <Button
              size="sm"
              variant={showCreate ? "secondary" : "ghost"}
              onClick={() => setShowCreate((v) => !v)}
            >
              {showCreate ? "Cancel" : "+ Other Role"}
            </Button>
          </div>
        }
      />

      {notice && (
        <div className="rounded-lg border border-success/25 bg-success/10 px-4 py-2.5 text-sm text-success">
          {notice}
        </div>
      )}
      {formError && (
        <div className="rounded-lg border border-danger/25 bg-danger/10 px-4 py-2.5 text-sm text-danger">
          {formError}
        </div>
      )}

      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle>Register {roleLabel(role)} / User Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <form
              onSubmit={handleCreate}
              className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
            >
              <Input
                placeholder="Username *"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
              <Input
                placeholder="Full name *"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
              <Input
                type="email"
                placeholder="Email *"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Input
                placeholder="Phone *"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
              <Select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                aria-label="Account role"
              >
                {ALL_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {roleLabel(r)}
                  </option>
                ))}
              </Select>
              <Input
                type="password"
                placeholder="Password (min 8 chars) *"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
              {role === "supplier" && (
                <Input
                  placeholder="Supplier company name"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              )}
              <Button type="submit" isLoading={creating}>
                Register {roleLabel(role)}
              </Button>
            </form>
            <p className="rounded-md border border-border bg-surface-subtle px-3 py-2 text-xs text-muted">
              <span className="font-semibold text-foreground">
                {roleLabel(role)} permissions:
              </span>{" "}
              {roleDescription(role)}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          placeholder="Search username, name, email, or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1"
        />
        <Select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="w-full sm:w-52"
        >
          <option value="">All Roles</option>
          {ALL_ROLES.map((r) => (
            <option key={r} value={r}>
              {roleLabel(r)}
            </option>
          ))}
        </Select>
      </div>

      {users.length === 0 ? (
        <EmptyState
          title="No users found"
          description="No user accounts match your filters."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-background shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Joined</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => {
                const isSelf = currentUser?.id === u.id;
                const normalizedUserRole = normalizeRole(u.role);
                const isLegacyRole = !(ALL_ROLES as readonly string[]).includes(
                  normalizedUserRole,
                );
                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="font-medium text-foreground">
                        {u.full_name}
                        {isSelf && (
                          <Badge variant="default" className="ml-2 text-[10px]">
                            You
                          </Badge>
                        )}
                      </div>
                      <p className="font-mono text-xs text-muted">
                        @{u.username}
                      </p>
                    </TableCell>
                    <TableCell className="text-xs text-muted">
                      <div>{u.email}</div>
                      <div>{u.phone}</div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={isLegacyRole ? u.role : normalizedUserRole}
                        disabled={isSelf || busyId === u.id}
                        onChange={(e) =>
                          void handleRoleUpdate(u.id, e.target.value)
                        }
                        className="h-8 w-40 text-xs"
                        aria-label={`Role for ${u.username}`}
                      >
                        {isLegacyRole && (
                          <option value={u.role} disabled>
                            {roleLabel(u.role)} (Removed)
                          </option>
                        )}
                        {ALL_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {roleLabel(r)}
                          </option>
                        ))}
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.is_active ? "success" : "danger"}>
                        {u.is_active ? "Active" : "Disabled"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted">
                      {formatDate(u.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant={u.is_active ? "secondary" : "success"}
                        disabled={isSelf || busyId === u.id}
                        isLoading={busyId === u.id}
                        onClick={() =>
                          void handleToggleActive(u.id, u.is_active)
                        }
                      >
                        {u.is_active ? "Disable" : "Activate"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
