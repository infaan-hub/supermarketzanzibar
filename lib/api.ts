// Typed API client with JWT Bearer injection & single-flight auto-refresh.

import {
  clearAccessToken,
  getAccessToken,
  setAccessToken,
} from "@/lib/auth/client";
import type {
  AllBarcodesResponse,
  AuthUser,
  BarcodeLookupResponse,
  CategoriesResponse,
  Category,
  CreateProductRequest,
  Customer,
  CustomerDetail,
  CustomersResponse,
  DashboardOverview,
  DashboardRange,
  ListOptions,
  LoginResponse,
  Payment,
  PaymentsResponse,
  Product,
  ProductBarcodeItem,
  ProductDetail,
  ProductsResponse,
  ReportsResponse,
  SaleDetail,
  SalesResponse,
  StockAdjustmentRequest,
  StockAdjustmentResponse,
  StockMovementsResponse,
  StockResponse,
  Supplier,
  SupplierDetail,
  SuppliersResponse,
  SystemInfoResponse,
  UpdateProductRequest,
  User,
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

// Single-flight refresh promise so concurrent 401s share one refresh call.
let refreshInFlight: Promise<{ access: string; user?: AuthUser } | null> | null =
  null;

export async function refreshAccessToken(): Promise<{
  access: string;
  user?: AuthUser;
} | null> {
  if (typeof window === "undefined") return null;
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!res.ok) {
        clearAccessToken();
        return null;
      }
      const data = (await res.json()) as { access?: string; user?: AuthUser };
      if (!data.access) {
        clearAccessToken();
        return null;
      }
      setAccessToken(data.access);
      return { access: data.access, user: data.user };
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

interface RequestConfig extends RequestInit {
  skipAuth?: boolean;
  _retried?: boolean;
}

async function request<T>(path: string, init?: RequestConfig): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const headers = new Headers(init?.headers ?? {});
  if (!headers.has("Accept")) headers.set("Accept", "application/json");

  if (!init?.skipAuth) {
    const token = getAccessToken();
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const res = await fetch(url, {
    ...init,
    credentials: "include",
    cache: "no-store",
    headers,
  });

  if (res.status === 401 && !init?.skipAuth && !init?._retried && typeof window !== "undefined") {
    const refreshed = await refreshAccessToken();
    if (refreshed?.access) {
      const retryHeaders = new Headers(init?.headers ?? {});
      if (!retryHeaders.has("Accept")) retryHeaders.set("Accept", "application/json");
      retryHeaders.set("Authorization", `Bearer ${refreshed.access}`);
      return request<T>(path, {
        ...init,
        headers: retryHeaders,
        _retried: true,
      });
    }
  }

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

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function queryString(options?: ListOptions): string {
  const params = new URLSearchParams();
  if (options?.search) params.set("search", options.search);
  if (options?.categoryId) params.set("categoryId", options.categoryId);
  if (options?.supplierId) params.set("supplierId", options.supplierId);
  if (options?.status) params.set("status", options.status);
  if (options?.method) params.set("method", options.method);
  if (options?.type) params.set("type", options.type);
  if (options?.role) params.set("role", options.role);
  if (options?.productId) params.set("productId", options.productId);
  if (options?.lowStock) params.set("lowStock", "true");
  if (options?.includeInactive) params.set("includeInactive", "true");
  if (options?.start) params.set("start", options.start);
  if (options?.end) params.set("end", options.end);
  if (options?.page) params.set("page", String(options.page));
  if (options?.take) params.set("take", String(options.take));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/* ------------------------------------------------------------------ */
/* Auth                                                               */
/* ------------------------------------------------------------------ */

export async function loginRequest(
  username: string,
  password: string,
): Promise<LoginResponse> {
  return request<LoginResponse>("/api/auth/login", {
    method: "POST",
    skipAuth: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
}

export async function logoutRequest(): Promise<void> {
  try {
    await request("/api/auth/logout", { method: "POST", skipAuth: true });
  } finally {
    clearAccessToken();
  }
}

export async function fetchMe(): Promise<{ user: AuthUser }> {
  return request<{ user: AuthUser }>("/api/auth/me");
}

export async function updateMe(input: {
  full_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  current_password?: string;
  new_password?: string;
}): Promise<{ user: AuthUser }> {
  return request<{ user: AuthUser }>("/api/auth/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function fetchBootstrap(): Promise<{ hasAdmin: boolean }> {
  return request<{ hasAdmin: boolean }>("/api/auth/bootstrap", { skipAuth: true });
}

/* ------------------------------------------------------------------ */
/* Products & Barcodes                                                */
/* ------------------------------------------------------------------ */

export async function fetchProducts(
  options?: ListOptions,
): Promise<ProductsResponse> {
  return request<ProductsResponse>(`/api/products${queryString(options)}`);
}

export async function fetchProductDetail(id: string): Promise<ProductDetail> {
  return request<ProductDetail>(`/api/products/${encodeURIComponent(id)}`);
}

export async function createProduct(
  input: CreateProductRequest,
): Promise<Product> {
  return request<Product>("/api/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function updateProduct(
  id: string,
  input: UpdateProductRequest,
): Promise<Product> {
  return request<Product>(`/api/products/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function archiveProduct(id: string): Promise<{ detail: string }> {
  return request<{ detail: string }>(`/api/products/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function lookupBarcode(
  barcode: string,
): Promise<BarcodeLookupResponse> {
  return request<BarcodeLookupResponse>(
    `/api/barcodes/lookup?barcode=${encodeURIComponent(barcode)}`,
  );
}

export async function fetchAllBarcodes(): Promise<AllBarcodesResponse> {
  return request<AllBarcodesResponse>("/api/barcodes");
}

export async function createProductBarcodeLabel(input: {
  productId: string;
  barcode: string;
  unitId?: string;
  quantityMultiplier: number;
  isPrimary?: boolean;
}): Promise<ProductBarcodeItem> {
  return request<ProductBarcodeItem>("/api/barcodes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function deleteProductBarcodeLabel(
  id: string,
): Promise<{ detail: string }> {
  return request<{ detail: string }>(`/api/barcodes/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

/* ------------------------------------------------------------------ */
/* Categories                                                         */
/* ------------------------------------------------------------------ */

export async function fetchCategories(
  options?: ListOptions,
): Promise<CategoriesResponse> {
  return request<CategoriesResponse>(`/api/categories${queryString(options)}`);
}

export async function createCategory(input: {
  name: string;
  description?: string;
}): Promise<Category> {
  return request<Category>("/api/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function updateCategory(
  id: string,
  input: { name?: string; description?: string },
): Promise<Category> {
  return request<Category>(`/api/categories/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function deleteCategory(id: string): Promise<{ detail: string }> {
  return request<{ detail: string }>(`/api/categories/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

/* ------------------------------------------------------------------ */
/* Customers                                                          */
/* ------------------------------------------------------------------ */

export async function fetchCustomers(
  options?: ListOptions,
): Promise<CustomersResponse> {
  return request<CustomersResponse>(`/api/customers${queryString(options)}`);
}

export async function fetchCustomerDetail(id: string): Promise<CustomerDetail> {
  return request<CustomerDetail>(`/api/customers/${encodeURIComponent(id)}`);
}

export async function createCustomer(input: {
  name: string;
  phone: string;
  email?: string;
  address?: string;
}): Promise<Customer> {
  return request<Customer>("/api/customers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function updateCustomer(
  id: string,
  input: {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
    loyaltyPoints?: number;
  },
): Promise<CustomerDetail> {
  return request<CustomerDetail>(`/api/customers/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

/* ------------------------------------------------------------------ */
/* Suppliers                                                          */
/* ------------------------------------------------------------------ */

export async function fetchSuppliers(
  options?: ListOptions,
): Promise<SuppliersResponse> {
  return request<SuppliersResponse>(`/api/suppliers${queryString(options)}`);
}

export async function fetchSupplierDetail(id: string): Promise<SupplierDetail> {
  return request<SupplierDetail>(`/api/suppliers/${encodeURIComponent(id)}`);
}

export async function createSupplier(input: {
  companyName: string;
  contactName: string;
  phone: string;
  email?: string;
  address?: string;
}): Promise<Supplier> {
  return request<Supplier>("/api/suppliers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function updateSupplier(
  id: string,
  input: {
    companyName?: string;
    contactName?: string;
    phone?: string;
    email?: string;
    address?: string;
  },
): Promise<SupplierDetail> {
  return request<SupplierDetail>(`/api/suppliers/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

/* ------------------------------------------------------------------ */
/* Users                                                              */
/* ------------------------------------------------------------------ */

export async function fetchUsers(options?: ListOptions): Promise<UsersResponse> {
  return request<UsersResponse>(`/api/users${queryString(options)}`);
}

export async function createUser(input: {
  username: string;
  email: string;
  full_name: string;
  phone: string;
  address?: string;
  role: string;
  password: string;
  companyName?: string;
}): Promise<User> {
  return request<User>("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function updateUser(
  id: string,
  input: {
    role?: string;
    is_active?: boolean;
    full_name?: string;
    password?: string;
  },
): Promise<User> {
  return request<User>(`/api/users/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

/* ------------------------------------------------------------------ */
/* Sales & Checkout                                                   */
/* ------------------------------------------------------------------ */

export async function fetchSales(options?: ListOptions): Promise<SalesResponse> {
  return request<SalesResponse>(`/api/sales${queryString(options)}`);
}

export async function fetchSaleDetail(id: string): Promise<SaleDetail> {
  return request<SaleDetail>(`/api/sales/${encodeURIComponent(id)}`);
}

export async function updateSaleStatus(
  id: string,
  status: string,
): Promise<SaleDetail> {
  return request<SaleDetail>(`/api/sales/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

export interface CheckoutPayload {
  items: Array<{ productId: string; quantity: number; price?: number }>;
  customerId?: string | null;
  customerFullName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  paymentMethod: "cash" | "mobile_money" | "card" | "bank_transfer";
  taxRatePercent?: number;
  discount?: number;
}

export interface CheckoutResponse {
  sale: {
    id: string;
    customerFullName: string;
    customerEmail: string;
    paymentMethod: string;
    status: string;
    subtotal: number;
    discount: number;
    taxAmount: number;
    grandTotal: number;
    paymentStatus: string;
    controlNumber: string;
    createdAt: string;
  };
  receipt: string;
}

export async function submitCheckout(
  payload: CheckoutPayload,
): Promise<CheckoutResponse> {
  return request<CheckoutResponse>("/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/* ------------------------------------------------------------------ */
/* Stock & Movements                                                  */
/* ------------------------------------------------------------------ */

export async function fetchStock(): Promise<StockResponse> {
  return request<StockResponse>("/api/stock");
}

export async function fetchStockMovements(
  options?: ListOptions,
): Promise<StockMovementsResponse> {
  return request<StockMovementsResponse>(
    `/api/stock/movements${queryString(options)}`,
  );
}

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

export async function fetchPayments(
  options?: ListOptions,
): Promise<PaymentsResponse> {
  return request<PaymentsResponse>(`/api/payments${queryString(options)}`);
}

export async function updatePaymentStatus(
  id: string,
  status: "confirmed" | "pending" | "failed" | "refunded",
): Promise<Payment> {
  return request<Payment>(`/api/payments/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

/* ------------------------------------------------------------------ */
/* Dashboard, Reports & System Settings                               */
/* ------------------------------------------------------------------ */

export async function fetchDashboard(
  range: DashboardRange,
): Promise<DashboardOverview> {
  return request<DashboardOverview>(
    `/api/dashboard/overview?range=${encodeURIComponent(range)}`,
  );
}

export async function fetchReports(
  range: DashboardRange,
): Promise<ReportsResponse> {
  return request<ReportsResponse>(
    `/api/reports?range=${encodeURIComponent(range)}`,
  );
}

export async function fetchSystemInfo(): Promise<SystemInfoResponse> {
  return request<SystemInfoResponse>("/api/settings");
}
