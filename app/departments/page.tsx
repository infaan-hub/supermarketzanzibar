"use client";

import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/auth/auth-provider";
import { isManagerRole } from "@/lib/auth/roles";
import { createDepartment, fetchDepartments } from "@/lib/api";
import type { DepartmentSummary } from "@/types/api";

export default function DepartmentsPage() {
  const { user } = useAuth();
  const canManage = isManagerRole(user?.role);

  const [departments, setDepartments] = React.useState<DepartmentSummary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  const [code, setCode] = React.useState("");
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchDepartments();
      setDepartments(res.departments);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load departments.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await createDepartment({ code, name, description });
      setCode("");
      setName("");
      setDescription("");
      setSuccess("Department created in PostgreSQL.");
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create department.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">
            Supermarket Spatial Directory
          </p>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Store Departments
          </h1>
          <p className="text-sm text-muted">
            Every retail department connects live shelf stock to its 3D Digital
            Twin aisle zone.
          </p>
        </div>
        <Link href="/digital-twin">
          <Button size="sm">Open 3D Supermarket</Button>
        </Link>
      </div>

      {error && (
        <div className="rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-xl border border-success/25 bg-success/10 px-4 py-3 text-sm text-success">
          {success}
        </div>
      )}

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add Department</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleCreate}
              className="grid gap-3 sm:grid-cols-4"
            >
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Code (e.g. SPICE)"
                required
              />
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Department name"
                required
              />
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short description"
              />
              <Button type="submit" isLoading={saving}>
                Create Department
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <p className="text-sm text-muted">Loading store departments…</p>
      ) : departments.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted">
              No departments initialized yet. Launch the{" "}
              <Link href="/digital-twin" className="font-semibold text-teal-700 underline">
                3D Digital Twin
              </Link>{" "}
              to initialize all 10 retail departments automatically.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {departments.map((dept) => (
            <Card key={dept.id} className="flex flex-col justify-between">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono text-xs font-bold text-teal-700">
                      {dept.code}
                    </span>
                    <CardTitle className="mt-0.5 text-lg">{dept.name}</CardTitle>
                  </div>
                  <Badge
                    variant={
                      dept.outOfStockCount > 0
                        ? "danger"
                        : dept.lowStockCount > 0
                          ? "warning"
                          : "success"
                    }
                  >
                    {dept.outOfStockCount > 0
                      ? `${dept.outOfStockCount} out`
                      : dept.lowStockCount > 0
                        ? `${dept.lowStockCount} low`
                        : "Healthy"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted">
                  {dept.description || "Retail aisle department."}
                </p>
                <div className="grid grid-cols-3 gap-2 rounded-lg bg-surface-subtle p-2.5 text-center">
                  <div>
                    <p className="text-[11px] text-muted">Shelves</p>
                    <p className="font-display text-base font-bold tabular-nums">
                      {dept.shelvesCount}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted">SKUs</p>
                    <p className="font-display text-base font-bold tabular-nums">
                      {dept.productCount}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted">Units</p>
                    <p className="font-display text-base font-bold tabular-nums text-teal-800">
                      {dept.totalUnits}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/digital-twin?dept=${encodeURIComponent(dept.code)}`}
                    className="flex-1"
                  >
                    <Button size="sm" className="w-full">
                      Inspect in 3D
                    </Button>
                  </Link>
                  <Link href={`/shelves?dept=${encodeURIComponent(dept.code)}`}>
                    <Button size="sm" variant="secondary">
                      Shelves
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
