"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fetchBootstrap } from "@/lib/api";

interface FormState {
  username: string;
  email: string;
  full_name: string;
  phone: string;
  address: string;
  password: string;
  password_confirm: string;
}

const initial: FormState = {
  username: "",
  email: "",
  full_name: "",
  phone: "",
  address: "",
  password: "",
  password_confirm: "",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initial);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [successRole, setSuccessRole] = useState<string | null>(null);
  const [isBootstrapAdmin, setIsBootstrapAdmin] = useState(false);

  useEffect(() => {
    fetchBootstrap()
      .then((res) => setIsBootstrapAdmin(!res.hasAdmin))
      .catch(() => undefined);
  }, []);

  function update<K extends keyof FormState>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!form.username.trim()) errs.username = "Username is required.";
    if (!form.email.trim()) errs.email = "Email is required.";
    else if (!EMAIL_RE.test(form.email.trim())) {
      errs.email = "Enter a valid email address.";
    }
    if (!form.full_name.trim()) errs.full_name = "Full name is required.";
    if (!form.phone.trim()) errs.phone = "Phone is required.";
    if (!form.password) errs.password = "Password is required.";
    else if (form.password.length < 8) {
      errs.password = "Password must be at least 8 characters.";
    }
    if (form.password !== form.password_confirm) {
      errs.password_confirm = "Passwords do not match.";
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.username.trim(),
          email: form.email.trim(),
          full_name: form.full_name.trim(),
          phone: form.phone.trim(),
          address: form.address.trim(),
          password: form.password,
          password_confirm: form.password_confirm,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      if (!res.ok) {
        const fe: Record<string, string> = {};
        let general: string | null = null;
        for (const [k, v] of Object.entries(data ?? {})) {
          if (Array.isArray(v) && v.length) {
            fe[k] = String(v[0]);
          } else if (typeof v === "string") {
            if (k === "detail" || k === "message") general = v;
            else fe[k] = v;
          }
        }
        setFieldErrors(fe);
        setError(general);
        if (!general && Object.keys(fe).length === 0) {
          setError("Registration failed. Please check your details.");
        }
        return;
      }
      setSuccessRole(typeof data.role === "string" ? data.role : "customer");
      setTimeout(() => router.push("/login"), 1400);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (successRole) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm rounded-lg border border-border bg-white p-8 text-center shadow-card">
          <p className="text-base font-semibold text-success">
            {successRole === "admin"
              ? "Administrator account created"
              : "Account created"}
          </p>
          <p className="mt-1 text-sm text-muted">Redirecting to sign in…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[84vh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg space-y-5">
        <div className="space-y-2 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-3 text-foreground"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#4CAF50] text-xs font-extrabold text-white shadow-[0_6px_16px_rgba(76,175,80,0.4)]">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
            </span>
            <span className="font-display text-lg font-extrabold tracking-tight text-white">
              Marketplace
            </span>
          </Link>
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              {isBootstrapAdmin ? "Initial administrator setup" : "Create an account"}
            </h1>
            {isBootstrapAdmin && <Badge variant="success">First Admin</Badge>}
          </div>
          <p className="text-sm text-muted">
            {isBootstrapAdmin
              ? "Create the first administrator account for your store."
              : "Register your details. Staff permissions can be granted by an administrator."}
          </p>
        </div>

        <div className="rounded-lg border border-border bg-white p-6 shadow-card">
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {error && (
              <div
                role="alert"
                className="rounded-md border border-danger/25 bg-danger-soft px-3 py-2 text-xs text-danger"
              >
                {error}
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="username" className="text-xs font-medium text-foreground">
                  Username
                </label>
                <Input
                  id="username"
                  value={form.username}
                  onChange={(e) => update("username", e.target.value)}
                  required
                />
                {fieldErrors.username && (
                  <p className="text-xs text-danger">{fieldErrors.username}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-xs font-medium text-foreground">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  required
                />
                {fieldErrors.email && (
                  <p className="text-xs text-danger">{fieldErrors.email}</p>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="full_name" className="text-xs font-medium text-foreground">
                Full name
              </label>
              <Input
                id="full_name"
                value={form.full_name}
                onChange={(e) => update("full_name", e.target.value)}
                required
              />
              {fieldErrors.full_name && (
                <p className="text-xs text-danger">{fieldErrors.full_name}</p>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="phone" className="text-xs font-medium text-foreground">
                  Phone
                </label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  required
                />
                {fieldErrors.phone && (
                  <p className="text-xs text-danger">{fieldErrors.phone}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <label htmlFor="address" className="text-xs font-medium text-foreground">
                  Address (optional)
                </label>
                <Input
                  id="address"
                  value={form.address}
                  onChange={(e) => update("address", e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="password" className="text-xs font-medium text-foreground">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => update("password", e.target.value)}
                  required
                />
                {fieldErrors.password && (
                  <p className="text-xs text-danger">{fieldErrors.password}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <label htmlFor="password_confirm" className="text-xs font-medium text-foreground">
                  Confirm password
                </label>
                <Input
                  id="password_confirm"
                  type="password"
                  autoComplete="new-password"
                  value={form.password_confirm}
                  onChange={(e) => update("password_confirm", e.target.value)}
                  required
                />
                {fieldErrors.password_confirm && (
                  <p className="text-xs text-danger">
                    {fieldErrors.password_confirm}
                  </p>
                )}
              </div>
            </div>
            <Button type="submit" size="lg" className="w-full" isLoading={loading}>
              {isBootstrapAdmin ? "Create administrator" : "Create account"}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-foreground hover:text-primary hover:underline">
            Sign in
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
