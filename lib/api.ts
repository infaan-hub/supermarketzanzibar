// Typed API client for the Supermarket Zanzibar frontend.
//
// Centralizes the base URL, request shaping and error handling so every page
// talks to the same contract produced by app/api/. Uses relative URLs so the
// frontend works on localhost and in production without hardcoded hosts.

import type {
  BarcodeLookupResponse,
  CategoriesResponse,
  CreateProductRequest,
  CustomersResponse,
  DashboardResponse,
  ListOptions,
  PaymentsResponse,
  Product,
  ProductsResponse,
  SalesResponse,
  StockAdjustmentRequest,
  StockAdjustmentResponse,
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

function errorMessageFromBody(body: unknown, fallback: string): string {
  if (typeof body !== "object" || body === null) return fallback;

  const record = body as Record<string, unknown>;
  if (typeof record.detail === "string" && record.detail.trim()) {
    return record.detail;
  }
  if (typeof record.message === "string" && record.message.trim()) {
    return record.message;
  }

  // DRF-style validation errors are `{ field: ["message", ...] }`.
  const messages: string[] = [];
  for (const [field, value] of Object.entries(record)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string") {
          messages.push(field === "detail" ? item : `${field}: ${item}`);
        }
      }
    } else if (typeof value === "string") {
      messages.push(`${field}: ${value}`);
    }
  }

  return messages.length > 0 ? messages.join(" ") : fallback;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const fallback = `Request failed (${res.status})`;
    let detail = fallback;
    let body: unknown;
    try {
      body = await res.json();
      detail = errorMessageFromBody(body, fallback);
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

/** Register a product from the inventory terminal, including its barcode. */
export async function createProduct(
  input: CreateProductRequest,
): Promise<Product> {
  return request<Product>("/api/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

/* ------------------------------------------------------------------ */
/* Barcodes                                                           */
/* ------------------------------------------------------------------ */

/** Resolve a scanned Code 128 label to a product and packaging unit. */
export async function lookupBarcode(
  barcode: string,
): Promise<BarcodeLookupResponse> {
  return request<BarcodeLookupResponse>(
    `/api/barcodes/lookup?barcode=${encodeURIComponent(barcode)}`,
  );
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

/** Receive or issue stock for a scanned barcode. */
export async function adjustStockByBarcode(
  input: StockAdjustmentRequest,
): Promise<StockAdjustmentResponse> {
  return request<StockAdjustmentResponse>("/api/stock/movements", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
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
