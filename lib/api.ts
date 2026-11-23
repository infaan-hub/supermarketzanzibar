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
  bypassCache?: boolean;
}

const GET_CACHE_TTL_MS = 8_000;
const getResponseCache = new Map<string, { expiresAt: number; data: unknown }>();
const getInFlight = new Map<string, Promise<unknown>>();

export function invalidateApiCache() {
  getResponseCache.clear();
}

async function performRequest<T>(path: string, init?: RequestConfig): Promise<T> {
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
      return performRequest<T>(path, {
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

async function request<T>(path: string, init?: RequestConfig): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const isGet = method === "GET";

  if (!isGet) {
    getResponseCache.clear();
    return performRequest<T>(path, init);
  }

  if (typeof window !== "undefined" && !init?.bypassCache) {
    const cached = getResponseCache.get(path);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data as T;
    }
    const existing = getInFlight.get(path);
    if (existing) {
      return existing as Promise<T>;
    }
  }

  const promise = performRequest<T>(path, init)
    .then((data) => {
      if (typeof window !== "undefined") {
        getResponseCache.set(path, {
          expiresAt: Date.now() + GET_CACHE_TTL_MS,
          data,
        });
      }
      return data;
    })
    .finally(() => {
      getInFlight.delete(path);
    });

  if (typeof window !== "undefined") {
    getInFlight.set(path, promise);
  }
  return promise;
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
  return request<{ user: AuthUser }>("/api/auth/me", { bypassCache: true });
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

export async function uploadProfileImage(file: File): Promise<{
  profile_image_available: boolean;
  profile_image_url: string;
  updatedAt: string;
}> {
  const formData = new FormData();
  formData.append("file", file);
  return request<{
    profile_image_available: boolean;
    profile_image_url: string;
    updatedAt: string;
  }>("/api/auth/me/image", {
    method: "POST",
    body: formData,
  });
}

export async function deleteProfileImage(): Promise<{
  profile_image_available: boolean;
}> {
  return request<{ profile_image_available: boolean }>("/api/auth/me/image", {
    method: "DELETE",
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

export async function uploadProductImage(
  id: string,
  file: File,
): Promise<{
  id: string;
  image_available: boolean;
  imageName: string;
  imageContentType: string;
  updatedAt: string;
}> {
  const formData = new FormData();
  formData.append("file", file);
  return request(`/api/products/${encodeURIComponent(id)}/image`, {
    method: "POST",
    body: formData,
  });
}

export async function deleteProductImage(
  id: string,
): Promise<{ id: string; image_available: boolean; updatedAt: string }> {
  return request(`/api/products/${encodeURIComponent(id)}/image`, {
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
    username?: string;
    email?: string;
    phone?: string;
    address?: string;
    role?: string;
    is_active?: boolean;
    full_name?: string;
    password?: string;
    companyName?: string;
  },
): Promise<User> {
  return request<User>(`/api/users/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function deleteUser(id: string): Promise<{ detail: string }> {
  return request<{ detail: string }>(`/api/users/${encodeURIComponent(id)}`, {
    method: "DELETE",
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
  idempotencyKey?: string;
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

/* ------------------------------------------------------------------ */
/* 3D Digital Twin, Departments, Shelves, Warehouse, POs & GRN        */
/* ------------------------------------------------------------------ */

export async function fetchDigitalTwin(): Promise<
  import("@/types/digital-twin").DigitalTwinSnapshot
> {
  return request<import("@/types/digital-twin").DigitalTwinSnapshot>(
    "/api/digital-twin",
  );
}

export async function initializeDigitalTwin(): Promise<
  import("@/types/digital-twin").DigitalTwinSnapshot
> {
  return request<import("@/types/digital-twin").DigitalTwinSnapshot>(
    "/api/digital-twin",
    { method: "POST" },
  );
}

export async function locateInTwin(
  query: string,
): Promise<import("@/types/digital-twin").TwinLocateResult> {
  return request<import("@/types/digital-twin").TwinLocateResult>(
    `/api/digital-twin/locate?q=${encodeURIComponent(query)}`,
  );
}

export async function transferWarehouseStockToShelf(input: {
  shelfPositionId: string;
  warehouseLocationId?: string;
  quantity: number;
  allowAddColumn?: boolean;
  notes?: string;
}): Promise<{
  movementId: string;
  productId: string;
  productName: string;
  shelfCode: string;
  positionId: string;
  positionCode: string;
  newShelfQuantity: number;
  newWarehouseQuantity: number;
  addedColumnCodes?: string[];
}> {
  return request("/api/digital-twin/transfer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function fetchDepartments(): Promise<{
  departments: import("@/types/api").DepartmentSummary[];
  migrationRequired?: boolean;
}> {
  return request("/api/departments");
}

export async function createDepartment(input: {
  code: string;
  name: string;
  description?: string;
}): Promise<{ department: import("@/types/api").DepartmentSummary }> {
  return request("/api/departments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function updateDepartment(
  id: string,
  input: { name?: string; description?: string; status?: "active" | "inactive" },
): Promise<{ department: import("@/types/api").DepartmentSummary }> {
  return request(`/api/departments/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function fetchShelves(departmentCode?: string): Promise<{
  shelves: import("@/types/api").ShelfRecord[];
  migrationRequired?: boolean;
}> {
  const qs = departmentCode
    ? `?department=${encodeURIComponent(departmentCode)}`
    : "";
  return request(`/api/shelves${qs}`);
}

export async function createShelf(input: {
  departmentId: string;
  shelfCode: string;
  shelfName: string;
  fixtureKind?: string;
  capacity?: number;
  slotCount?: number;
}) {
  return request("/api/shelves", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function updateShelfPosition(
  positionId: string,
  input: {
    productId?: string | null;
    maximumCapacity?: number;
    reorderLevel?: number;
    reservedQuantity?: number;
  },
) {
  return request(`/api/shelves/positions/${encodeURIComponent(positionId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function addShelfColumn(
  shelfId: string,
  input: {
    productId?: string | null;
    sourcePositionId?: string;
    maximumCapacity?: number;
    reorderLevel?: number;
  } = {},
): Promise<{
  column: {
    id: string;
    shelfId: string;
    shelfCode: string;
    positionCode: string;
    slotIndex: number;
    quantity: number;
    maximumCapacity: number;
    reorderLevel: number;
    product: { id: string; name: string; barcode: string } | null;
  };
}> {
  return request(`/api/shelves/${encodeURIComponent(shelfId)}/columns`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function fetchWarehouse(params?: {
  zone?: string;
  rack?: string;
}): Promise<import("@/types/api").WarehouseOverviewResponse> {
  const qs = new URLSearchParams();
  if (params?.zone) qs.set("zone", params.zone);
  if (params?.rack) qs.set("rack", params.rack);
  const tail = qs.toString() ? `?${qs.toString()}` : "";
  return request(`/api/warehouse${tail}`);
}

export async function receiveDirectWarehouseStock(input: {
  productId: string;
  warehouseLocationId: string;
  quantity: number;
  batchNumber?: string;
  expiryDate?: string;
  notes?: string;
}) {
  return request("/api/warehouse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function fetchPurchaseOrders(status?: string): Promise<{
  purchaseOrders: import("@/types/api").PurchaseOrderRecord[];
  migrationRequired?: boolean;
}> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  return request(`/api/purchase-orders${qs}`);
}

export async function createPurchaseOrder(input: {
  supplierId: string;
  expectedDate?: string;
  notes?: string;
  items: Array<{ productId: string; orderedQuantity: number; unitCost: number }>;
}) {
  return request("/api/purchase-orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function updatePurchaseOrderStatus(
  id: string,
  status: "draft" | "ordered" | "partially_received" | "received" | "cancelled",
) {
  return request(`/api/purchase-orders/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

export async function fetchGoodsReceipts(): Promise<{
  receipts: import("@/types/api").GoodsReceiptRecord[];
  migrationRequired?: boolean;
}> {
  return request("/api/goods-received");
}

export async function createGoodsReceipt(input: {
  purchaseOrderId?: string | null;
  warehouseLocationId?: string | null;
  notes?: string;
  items: Array<{
    productId: string;
    quantity: number;
    batchNumber?: string;
    expiryDate?: string;
  }>;
}) {
  return request("/api/goods-received", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function fetchInventoryBatches(filter?: string): Promise<{
  batches: import("@/types/api").InventoryBatchRecord[];
  migrationRequired?: boolean;
}> {
  const qs = filter ? `?filter=${encodeURIComponent(filter)}` : "";
  return request(`/api/batches${qs}`);
}

export async function createInventoryBatch(input: {
  productId: string;
  batchNumber: string;
  quantity: number;
  expiryDate?: string | null;
  warehouseLocationId?: string | null;
  status?: "active" | "expired" | "quarantined";
}) {
  return request("/api/batches", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function submitStockAdjustment(input: {
  productId: string;
  reason: "DAMAGED" | "LOST" | "EXPIRED" | "COUNT" | "ADJUSTMENT_IN" | "ADJUSTMENT_OUT";
  quantity: number;
  notes?: string;
}) {
  return request<{
    product: { id: string; name: string; quantity: number };
    movementId: string;
    delta: number;
    reason: string;
  }>("/api/stock/adjustments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

/* ------------------------------------------------------------------ */
/* Public Guest Storefront & Supplier Portal                          */
/* ------------------------------------------------------------------ */

export async function fetchPublicCatalog(options?: {
  search?: string;
  categoryId?: string;
  take?: number;
}): Promise<import("@/types/api").PublicCatalogResponse> {
  const qs = new URLSearchParams();
  if (options?.search) qs.set("search", options.search);
  if (options?.categoryId) qs.set("categoryId", options.categoryId);
  if (options?.take) qs.set("take", String(options.take));
  const tail = qs.toString() ? `?${qs.toString()}` : "";
  const res = await fetch(`/api/public/catalog${tail}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error("Unable to load storefront products.");
  }
  return (await res.json()) as import("@/types/api").PublicCatalogResponse;
}

export async function fetchPublicDigitalTwin(): Promise<
  import("@/types/digital-twin").DigitalTwinSnapshot
> {
  const res = await fetch("/api/public/digital-twin", { cache: "no-store" });
  if (!res.ok) {
    throw new Error("Unable to load public 3D store view.");
  }
  return (await res.json()) as import("@/types/digital-twin").DigitalTwinSnapshot;
}

export async function fetchSupplierPortal(
  supplierId?: string,
): Promise<import("@/types/api").SupplierPortalResponse> {
  const qs = supplierId ? `?supplierId=${encodeURIComponent(supplierId)}` : "";
  return request<import("@/types/api").SupplierPortalResponse>(
    `/api/supplier/portal${qs}`,
  );
}
