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
  category: { id: string; name: string } | null;
  quantity: number;
  lowStockThreshold: number;
  reorderLevel: number;
}

export interface StockResponse {
  stock: StockItem[];
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

export interface DashboardStats {
  totalSalesToday: number;
  totalSalesWeek: number;
  totalSalesMonth: number;
  lowStockCount: number;
  pendingPayments: number;
  totalCustomers: number;
  totalProducts: number;
}

export interface RecentSale {
  id: string;
  customer: { name: string } | null;
  totalAmount: number | string;
  status: string;
  createdAt: string;
}

export interface DashboardResponse {
  stats: DashboardStats;
  recentSales: RecentSale[];
}

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
