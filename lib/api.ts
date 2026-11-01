// Typed API client for the Supermarket Zanzibar frontend.
//
// Centralizes the base URL, request shaping and error handling so every page
// talks to the same contract produced by app/api/. Uses relative URLs so the
// frontend works on localhost and in production without hardcoded hosts.

import type {
  CategoriesResponse,
  CustomersResponse,
  DashboardResponse,
  ListOptions,
  PaymentsResponse,
  ProductsResponse,
  SalesResponse,
  StockResponse,
  SuppliersResponse,
  UsersResponse,
} from "@/types/api";

const BASE_URL =
  typeof window === "undefined"
    ? (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000")
    : "";

export class ApiError extends Error {
  constructor(
    public message: string,
    public status: number,
    public body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    let body: unknown;
    try {
      body = await res.json();
      detail =
        (body as { detail?: string })?.detail ??
        (body as { message?: string })?.message ??
        detail;
    } catch {
      body = null;
    }
    throw new ApiError(detail, res.status, body);
  }

  return (await res.json()) as T;
}

function queryString(options?: ListOptions): string {
  const params = new URLSearchParams();
  if (options?.search) params.set("search", options.search);
  if (options?.categoryId) params.set("categoryId", options.categoryId);
  if (options?.status) params.set("status", options.status);
  if (options?.role) params.set("role", options.role);
  if (options?.start) params.set("start", options.start);
  if (options?.end) params.set("end", options.end);
  if (options?.page) params.set("page", String(options.page));
  if (options?.take) params.set("take", String(options.take));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/* ------------------------------------------------------------------ */
/* Products                                                           */
/* ------------------------------------------------------------------ */

export async function fetchProducts(
  options?: ListOptions,
): Promise<ProductsResponse> {
  return request<ProductsResponse>(`/api/products${queryString(options)}`);
}

/* ------------------------------------------------------------------ */
/* Categories                                                         */
/* ------------------------------------------------------------------ */

export async function fetchCategories(): Promise<CategoriesResponse> {
  return request<CategoriesResponse>("/api/products/categories");
}

/* ------------------------------------------------------------------ */
/* Customers                                                          */
/* ------------------------------------------------------------------ */

export async function fetchCustomers(
  options?: ListOptions,
): Promise<CustomersResponse> {
  return request<CustomersResponse>(`/api/customers${queryString(options)}`);
}

/* ------------------------------------------------------------------ */
/* Suppliers                                                          */
/* ------------------------------------------------------------------ */

export async function fetchSuppliers(
  options?: ListOptions,
): Promise<SuppliersResponse> {
  return request<SuppliersResponse>(`/api/suppliers${queryString(options)}`);
}

/* ------------------------------------------------------------------ */
/* Users                                                              */
/* ------------------------------------------------------------------ */

export async function fetchUsers(options?: ListOptions): Promise<UsersResponse> {
  return request<UsersResponse>(`/api/users${queryString(options)}`);
}

/* ------------------------------------------------------------------ */
/* Sales                                                              */
/* ------------------------------------------------------------------ */

export async function fetchSales(options?: ListOptions): Promise<SalesResponse> {
  return request<SalesResponse>(`/api/sales${queryString(options)}`);
}

/* ------------------------------------------------------------------ */
/* Stock                                                              */
/* ------------------------------------------------------------------ */

export async function fetchStock(): Promise<StockResponse> {
  return request<StockResponse>("/api/stock");
}

/* ------------------------------------------------------------------ */
/* Payments                                                           */
/* ------------------------------------------------------------------ */

export async function fetchPayments(): Promise<PaymentsResponse> {
  return request<PaymentsResponse>("/api/payments");
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                          */
/* ------------------------------------------------------------------ */

export async function fetchDashboard(): Promise<DashboardResponse> {
  const [stats, salesResponse] = await Promise.all([
    request<DashboardResponse["stats"]>("/api/dashboard/stats"),
    request<{ sales: DashboardResponse["recentSales"] }>(
      "/api/sales?take=5&page=1",
    ),
  ]);
  return { stats, recentSales: salesResponse.sales };
}
