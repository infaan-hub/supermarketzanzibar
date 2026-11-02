// Users page.
//
// Browse user accounts, powered by the typed API client.

"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useUsers } from "@/hooks/useUsers";
import { formatDate } from "@/lib/format";

const ROLE_OPTIONS = [
  { value: "", label: "All Roles" },
  { value: "admin", label: "Admin" },
  { value: "cashier", label: "Cashier" },
  { value: "manager", label: "Manager" },
];

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const { data, loading, error } = useUsers({ search, role: roleFilter });

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <SkeletonText lines={2} className="w-[40%]" />
        </div>
        <div className="bg-background rounded-lg border border-border shadow-sm h-80">
          <SkeletonText lines={5} className="p-6" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-bold text-foreground">Users</h1>
        <EmptyState
          title="Unable to load users"
          description={error.message}
          action={
            <button onClick={() => window.location.reload()} className="btn-try">
              Try again
            </button>
          }
        />
      </div>
    );
  }

  const users = data?.users ?? [];

  if (users.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Users</h1>
            <p className="text-muted">User accounts for admin management.</p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Input placeholder="Search users…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full sm:w-64" />
            <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="w-full sm:w-48">
              {ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </div>
        </div>
        <EmptyState title="No users" description="No users match your filters." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Users</h1>
          <p className="text-muted">User accounts for admin management.</p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Input placeholder="Search users…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full sm:w-64" />
          <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="w-full sm:w-48">
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="bg-background rounded-lg border border-border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[16%] font-mono text-sm">Username</TableHead>
              <TableHead className="w-[18%]">Name</TableHead>
              <TableHead className="w-[22%]">Email</TableHead>
              <TableHead className="w-[14%]">Role</TableHead>
              <TableHead className="w-[14%]">Status</TableHead>
              <TableHead className="w-[16%] text-right">Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.username}</TableCell>
                <TableCell className="text-sm">{u.full_name}</TableCell>
                <TableCell className="text-sm text-muted">{u.email}</TableCell>
                <TableCell className="text-sm">
                  <Badge variant="secondary">{u.role}</Badge>
                </TableCell>
                <TableCell className="text-sm">
                  <Badge variant={u.is_active ? "success" : "secondary"}>
                    {u.is_active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted text-right">
                  {formatDate(u.createdAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
