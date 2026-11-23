// Users & RBAC management page (`/users` & `/admin/users`, admin only).
//
// Allows administrators to register Manager, MarketMaster, and other user
// accounts with login passwords, edit user details/roles/passwords, disable
// accounts, and delete users.

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
import { createUser, deleteUser, updateUser } from "@/lib/api";
import {
  ALL_ROLES,
  normalizeRole,
  roleDescription,
  roleLabel,
} from "@/lib/auth/roles";
import { formatDate } from "@/lib/format";
import type { User } from "@/types/api";

function generateStrongPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#!";
  const bytes = new Uint8Array(12);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const { data, loading, error, refresh } = useUsers({
    search: search.trim() || undefined,
    role: roleFilter || undefined,
  });

  // Registration form state
  const [showCreate, setShowCreate] = useState(false);
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [role, setRole] = useState("manager");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [creating, setCreating] = useState(false);

  // Edit user state
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUsername, setEditUsername] = useState("");
  const [editFullName, setEditFullName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editRole, setEditRole] = useState("manager");
  const [editIsActive, setEditIsActive] = useState(true);
  const [editCompanyName, setEditCompanyName] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editConfirmPassword, setEditConfirmPassword] = useState("");
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  // Row-level busy & page notifications
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const openCreateWithRole = (targetRole: string) => {
    setEditingUser(null);
    setRole(targetRole);
    setFormError(null);
    setNotice(null);
    setShowCreate(true);
  };

  const openEditForUser = (target: User) => {
    setShowCreate(false);
    setFormError(null);
    setNotice(null);
    const normalized = normalizeRole(target.role);
    const isKnown = (ALL_ROLES as readonly string[]).includes(normalized);
    setEditingUser(target);
    setEditUsername(target.username);
    setEditFullName(target.full_name);
    setEditEmail(target.email);
    setEditPhone(target.phone);
    setEditAddress(target.address ?? "");
    setEditRole(isKnown ? normalized : target.role);
    setEditIsActive(target.is_active);
    setEditCompanyName("");
    setEditPassword("");
    setEditConfirmPassword("");
    setShowEditPassword(false);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creating) return;
    setFormError(null);
    setNotice(null);

    if (password.length < 8) {
      setFormError("Login password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setFormError("Password and confirm password do not match.");
      return;
    }

    setCreating(true);
    try {
      const created = await createUser({
        username: username.trim(),
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        address: address.trim() || undefined,
        role,
        password,
        companyName: role === "supplier" ? companyName.trim() : undefined,
      });
      setUsername("");
      setFullName("");
      setEmail("");
      setPhone("");
      setAddress("");
      setPassword("");
      setConfirmPassword("");
      setShowCreatePassword(false);
      setCompanyName("");
      setShowCreate(false);
      setNotice(
        `${roleLabel(created.role)} account @${created.username} created. The user can now sign in at /login using their username or email and the password you set.`,
      );
      refresh();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Unable to create user.",
      );
    } finally {
      setCreating(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser || savingEdit) return;
    setFormError(null);
    setNotice(null);

    if (editPassword.length > 0) {
      if (editPassword.length < 8) {
        setFormError("New login password must be at least 8 characters.");
        return;
      }
      if (editPassword !== editConfirmPassword) {
        setFormError("New password and confirm password do not match.");
        return;
      }
    }

    const isSelf = currentUser?.id === editingUser.id;
    const normalizedEditRole = normalizeRole(editRole);
    const hasValidEditRole = (ALL_ROLES as readonly string[]).includes(
      normalizedEditRole,
    );

    setSavingEdit(true);
    try {
      const updated = await updateUser(editingUser.id, {
        username: editUsername.trim(),
        full_name: editFullName.trim(),
        email: editEmail.trim(),
        phone: editPhone.trim(),
        address: editAddress.trim(),
        ...(!isSelf && hasValidEditRole ? { role: normalizedEditRole } : {}),
        ...(!isSelf ? { is_active: editIsActive } : {}),
        ...(editPassword.length > 0 ? { password: editPassword } : {}),
        ...(normalizedEditRole === "supplier" && editCompanyName.trim()
          ? { companyName: editCompanyName.trim() }
          : {}),
      });
      setEditingUser(null);
      setEditPassword("");
      setEditConfirmPassword("");
      setNotice(
        editPassword.length > 0
          ? `Updated @${updated.username} and set a new login password.`
          : `Updated user @${updated.username}.`,
      );
      refresh();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Unable to update user.",
      );
    } finally {
      setSavingEdit(false);
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

  const handleDeleteUser = async (target: User) => {
    if (currentUser?.id === target.id) return;
    if (
      !window.confirm(
        `Permanently delete user "@${target.username}" (${target.full_name})? This cannot be undone.`,
      )
    ) {
      return;
    }

    setBusyId(target.id);
    setNotice(null);
    setFormError(null);
    try {
      const res = await deleteUser(target.id);
      if (editingUser?.id === target.id) {
        setEditingUser(null);
      }
      setNotice(res.detail || `Deleted user @${target.username}.`);
      refresh();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Unable to delete user.",
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
  const editingIsSelf = editingUser ? currentUser?.id === editingUser.id : false;
  const editingIsLegacyRole = editingUser
    ? !(ALL_ROLES as readonly string[]).includes(normalizeRole(editRole))
    : false;

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        title="Users & Permissions"
        description="Register Manager, MarketMaster, and other accounts with login passwords, edit user profiles, or remove accounts."
        actions={
          <div className="flex flex-wrap gap-2">
            {!showCreate && (
              <>
                <Button size="sm" onClick={() => openCreateWithRole("manager")}>
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
              onClick={() => {
                setEditingUser(null);
                setFormError(null);
                setShowCreate((v) => !v);
              }}
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

      {/* Register User Card */}
      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle>Register {roleLabel(role)} Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted">
                    Role *
                  </label>
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
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted">
                    Username *
                  </label>
                  <Input
                    placeholder="e.g. manager_ali"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="off"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted">
                    Full Name *
                  </label>
                  <Input
                    placeholder="e.g. Ali Hassan"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted">
                    Email *
                  </label>
                  <Input
                    type="email"
                    placeholder="name@supermarket.tz"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted">
                    Phone *
                  </label>
                  <Input
                    placeholder="+255 7XX XXX XXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted">
                    Address (optional)
                  </label>
                  <Input
                    placeholder="Stone Town, Zanzibar"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>

                {role === "supplier" && (
                  <div className="space-y-1 sm:col-span-2 lg:col-span-3">
                    <label className="text-xs font-medium text-muted">
                      Supplier Company Name
                    </label>
                    <Input
                      placeholder="e.g. Zanzibar Fresh Distributors"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-muted">
                      Login Password * (min 8 chars)
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const generated = generateStrongPassword();
                          setPassword(generated);
                          setConfirmPassword(generated);
                          setShowCreatePassword(true);
                        }}
                        className="text-[11px] font-medium text-primary hover:underline"
                      >
                        Generate
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowCreatePassword((v) => !v)}
                        className="text-[11px] font-medium text-muted hover:text-foreground"
                      >
                        {showCreatePassword ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>
                  <Input
                    type={showCreatePassword ? "text" : "password"}
                    placeholder="Set password for login"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted">
                    Confirm Login Password *
                  </label>
                  <Input
                    type={showCreatePassword ? "text" : "password"}
                    placeholder="Re-enter login password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </div>

                <div className="flex items-end">
                  <Button type="submit" isLoading={creating} className="w-full">
                    Register {roleLabel(role)}
                  </Button>
                </div>
              </div>
            </form>

            <div className="rounded-md border border-border bg-surface-subtle px-3 py-2 text-xs text-muted space-y-1">
              <p>
                <span className="font-semibold text-foreground">
                  {roleLabel(role)} permissions:
                </span>{" "}
                {roleDescription(role)}
              </p>
              <p>
                The registered user can immediately log in at{" "}
                <span className="font-mono text-foreground">/login</span> using
                their username (or email) and the login password set above.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit User Card */}
      {editingUser && (
        <Card className="border-primary/35">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>
              Edit User — {editingUser.full_name} (@{editingUser.username})
            </CardTitle>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setEditingUser(null)}
            >
              Cancel
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted">
                    Username *
                  </label>
                  <Input
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted">
                    Full Name *
                  </label>
                  <Input
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted">
                    Email *
                  </label>
                  <Input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted">
                    Phone *
                  </label>
                  <Input
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted">
                    Address
                  </label>
                  <Input
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted">Role</label>
                  <Select
                    value={editRole}
                    disabled={editingIsSelf}
                    onChange={(e) => setEditRole(e.target.value)}
                    aria-label="Edit user role"
                  >
                    {editingIsLegacyRole && (
                      <option value={editRole} disabled>
                        {roleLabel(editRole)} (Removed)
                      </option>
                    )}
                    {ALL_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {roleLabel(r)}
                      </option>
                    ))}
                  </Select>
                </div>

                {normalizeRole(editRole) === "supplier" && (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted">
                      Supplier Company Name (optional)
                    </label>
                    <Input
                      placeholder="Update company name"
                      value={editCompanyName}
                      onChange={(e) => setEditCompanyName(e.target.value)}
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted">
                    Account Status
                  </label>
                  <Select
                    value={editIsActive ? "active" : "disabled"}
                    disabled={editingIsSelf}
                    onChange={(e) =>
                      setEditIsActive(e.target.value === "active")
                    }
                    aria-label="Account status"
                  >
                    <option value="active">Active (can log in)</option>
                    <option value="disabled">Disabled (blocked)</option>
                  </Select>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-muted">
                      New Login Password (optional)
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const generated = generateStrongPassword();
                          setEditPassword(generated);
                          setEditConfirmPassword(generated);
                          setShowEditPassword(true);
                        }}
                        className="text-[11px] font-medium text-primary hover:underline"
                      >
                        Generate
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowEditPassword((v) => !v)}
                        className="text-[11px] font-medium text-muted hover:text-foreground"
                      >
                        {showEditPassword ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>
                  <Input
                    type={showEditPassword ? "text" : "password"}
                    placeholder="Leave blank to keep current password"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    autoComplete="new-password"
                    minLength={editPassword.length > 0 ? 8 : undefined}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted">
                    Confirm New Password
                  </label>
                  <Input
                    type={showEditPassword ? "text" : "password"}
                    placeholder="Re-enter new password"
                    value={editConfirmPassword}
                    onChange={(e) => setEditConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    disabled={editPassword.length === 0}
                    required={editPassword.length > 0}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <p className="text-xs text-muted">
                  <span className="font-semibold text-foreground">
                    {roleLabel(editRole)} permissions:
                  </span>{" "}
                  {roleDescription(editRole)}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setEditingUser(null)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" isLoading={savingEdit}>
                    Save Changes
                  </Button>
                </div>
              </div>
            </form>
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
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => {
                const isSelf = currentUser?.id === u.id;
                const normalizedUserRole = normalizeRole(u.role);
                const isLegacyRole = !(ALL_ROLES as readonly string[]).includes(
                  normalizedUserRole,
                );
                const isEditingRow = editingUser?.id === u.id;
                return (
                  <TableRow
                    key={u.id}
                    className={isEditingRow ? "bg-primary-soft/40" : undefined}
                  >
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
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busyId === u.id}
                          onClick={() => openEditForUser(u)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant={u.is_active ? "ghost" : "success"}
                          disabled={isSelf || busyId === u.id}
                          isLoading={busyId === u.id}
                          onClick={() =>
                            void handleToggleActive(u.id, u.is_active)
                          }
                        >
                          {u.is_active ? "Disable" : "Activate"}
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={isSelf || busyId === u.id}
                          onClick={() => void handleDeleteUser(u)}
                        >
                          Delete
                        </Button>
                      </div>
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
