// API response types for the Supermarket Zanzibar backend.
// These mirror the exact JSON contracts produced by app/api/ so the frontend
// stays typed and in sync with the server. Field names match the server as-is
// (mixed camelCase / snake_case) rather than being "normalized", because the
// frontend depends on the server's real response shape.

export interface Pagination {
  page: number;
  take: number;
  total: number;
  pages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: Pagination;
}

// ---- Products --------------------------------------------------------------

export interface ProductCategory {
  id: string;
  name: string;
}

export interface ProductSupplier {
  id: string;
  companyName: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  price: number | string;
  quantity: number;
  barcode?: string | null;
  /** Physical barcode scanned during registration, stored as an alias. */
  sourceBarcode?: string | null;
  description?: string | null;
  category: ProductCategory | null;
  supplier: ProductSupplier | null;
  image_available: boolean;
  createdAt: string;
}

export interface ProductsResponse {
  products: Product[];
  pagination: Pagination;
}

// ---- Barcodes --------------------------------------------------------------

export interface BarcodeLookupResponse {
  barcode: string;
  barcodeType: string;
  source: "product_barcodes" | "product";
  packaging: {
    unitId: string;
    quantityMultiplier: number;
    isPrimary: boolean;
  };
  product: {
    id: string;
    name: string;
    slug: string;
    category: ProductCategory | null;
    unitPrice: string;
    price: string;
    stock: number;
    isActive: boolean;
  };
  price: string;
  stock: number;
  availableUnits: number;
  inStock: boolean;
}

/** Payload for registering a product from the inventory terminal. */
export interface CreateProductRequest {
  name: string;
  /** Physical barcode scanned during counting; the system generates the product's own barcode. */
  sourceBarcode?: string;
  /** Legacy alias for `sourceBarcode`. */
  barcode?: string;
  price: number | string;
  costPrice?: number | string;
  /** Counted units; recorded as opening stock. */
  quantity?: number;
  categoryId?: string | null;
  description?: string;
}

// ---- Categories ------------------------------------------------------------

export interface Category {
  id: string;
  name: string;
  description: string;
  image_available: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CategoriesResponse {
  categories: Category[];
  pagination: Pagination;
}

// ---- Customers -------------------------------------------------------------

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  is_active: boolean;
  createdAt: string;
}

export interface CustomersResponse {
  customers: Customer[];
  pagination: Pagination;
}

// ---- Suppliers -------------------------------------------------------------

export interface Supplier {
  id: string;
  companyName: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  is_active: boolean;
  createdAt: string;
}

export interface SuppliersResponse {
  suppliers: Supplier[];
  pagination: Pagination;
}

// ---- Users -----------------------------------------------------------------

export interface User {
  id: string;
  username: string;
  email: string;
  phone: string;
  full_name: string;
  role: string;
  is_active: boolean;
  createdAt: string;
}

export interface UsersResponse {
  users: User[];
  pagination: Pagination;
}

// ---- Sales -----------------------------------------------------------------

export interface SaleItem {
  productId: string;
  productName: string;
  price: number | string;
  quantity: number;
  lineTotal: number | string;
}

export interface Sale {
  id: string;
  customer: { id: string; name: string } | null;
  items: SaleItem[];
  subtotal: number | string;
  taxAmount: number | string;
  discount: number | string;
  changeDue: number | string;
  grandTotal: number | string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  createdAt: string;
  updatedAt: string;
}

export interface SalesResponse {
  sales: Sale[];
  pagination: Pagination;
}

// ---- Stock -----------------------------------------------------------------

export interface StockItem {
  productId: string;
  productName: string;
  barcode: string;
  category: { id: string; name: string } | null;
  quantity: number;
  lowStockThreshold: number;
  reorderLevel: number;
}

export interface StockResponse {
  stock: StockItem[];
}

/** Receive (IN) or issue (OUT) stock for a scanned barcode. */
export interface StockAdjustmentRequest {
  barcode: string;
  movementType: "IN" | "OUT";
  /** Number of packages/scans; a pack label multiplies this by its factor. */
  quantity?: number;
}

export interface StockAdjustmentResponse {
  movement: {
    id: string;
    productId: string;
    quantity: number;
    movementType: "IN" | "OUT";
    date: string;
  };
  product: {
    id: string;
    name: string;
    barcode: string;
    quantity: number;
    unitId: string;
    quantityMultiplier: number;
  };
  packages: number;
  units: number;
}

// ---- Payments --------------------------------------------------------------

export interface Payment {
  id: string;
  saleId: string;
  amount: number | string;
  paymentMethod: string;
  status: string;
  referenceNumber: string;
  createdAt: string;
}

export interface PaymentsResponse {
  payments: Payment[];
}

// ---- Dashboard stats -------------------------------------------------------

/**
 * Shape kept for the legacy `/api/dashboard/stats` endpoint. The dashboard now
 * reads `/api/dashboard/overview`, but other integrations may still use this.
 */
export interface DashboardStats {
  totalSalesToday: number;
  totalSalesWeek: number;
  totalSalesMonth: number;
  lowStockCount: number;
  pendingPayments: number;
  totalCustomers: number;
  totalProducts: number;
}

// ---- Dashboard overview ----------------------------------------------------

export type DashboardRange = "today" | "week" | "month" | "year";

export interface DashboardMetricDelta {
  current: number;
  previous: number;
  change: number;
  /** Null when the previous period was zero, so no percentage exists. */
  changePercent: number | null;
  direction: "up" | "down" | "flat" | "new";
}

export interface DashboardRangeSummary {
  key: DashboardRange;
  label: string;
  contextLabel: string;
  comparisonLabel: string;
  start: string;
  end: string;
  previousStart: string;
  previousEnd: string;
}

export interface DashboardTrendPoint {
  bucket: string;
  label: string;
  fullLabel: string;
  revenue: number;
  orders: number;
}

export interface DashboardTrend {
  granularity: "hour" | "day" | "month";
  points: DashboardTrendPoint[];
}

export interface DashboardPaymentMethod {
  method: string;
  orders: number;
  amount: number;
  /** Share of confirmed orders in the period (0–1). */
  share: number;
}

export interface DashboardInventory {
  activeProducts: number;
  totalUnits: number;
  lowStockCount: number;
  outOfStockCount: number;
  stockValue: number;
}

export interface DashboardLowStockItem {
  id: string;
  name: string;
  barcode: string;
  category: string | null;
  quantity: number;
  threshold: number;
  price: number;
}

export interface DashboardPendingPayments {
  count: number;
  amount: number;
}

export interface DashboardRecentSale {
  id: string;
  customer: string;
  items: number;
  units: number;
  amount: number;
  paymentMethod: string;
  paymentStatus: string | null;
  status: string;
  createdAt: string;
}

export interface DashboardTopSeller {
  productId: string;
  name: string;
  quantity: number;
  revenue: number;
}

export interface DashboardStockMovement {
  id: string;
  product: string;
  type: string;
  quantity: number;
  date: string;
}

export interface DashboardOverview {
  generatedAt: string;
  timeZone: string;
  range: DashboardRangeSummary;
  metrics: {
    revenue: DashboardMetricDelta;
    orders: DashboardMetricDelta;
    averageOrderValue: DashboardMetricDelta;
  };
  trend: DashboardTrend;
  paymentMethods: DashboardPaymentMethod[];
  inventory: DashboardInventory;
  lowStock: {
    items: DashboardLowStockItem[];
    total: number;
  };
  pendingPayments: DashboardPendingPayments;
  recentSales: DashboardRecentSale[];
  topSellers: DashboardTopSeller[];
  stockMovements: DashboardStockMovement[];
}

/** @deprecated Use `DashboardOverview` for the live dashboard. */
export type DashboardResponse = DashboardOverview;

// ---- Request options -------------------------------------------------------

export interface ListOptions {
  search?: string;
  categoryId?: string;
  status?: string;
  role?: string;
  start?: string;
  end?: string;
  page?: number;
  take?: number;
}
