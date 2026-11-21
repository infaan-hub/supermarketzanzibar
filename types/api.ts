// API response & request types for the Supermarket Zanzibar full-stack app.

export interface Pagination {
  page: number;
  take: number;
  total: number;
  pages: number;
}

// ---- Auth ------------------------------------------------------------------

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  full_name: string;
  phone: string;
  address: string;
  role: string;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
}

export interface LoginResponse {
  access: string;
  refresh: string;
  user: AuthUser;
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

export interface ProductBarcodeItem {
  id: string;
  barcode: string;
  barcodeType: string;
  unitId: string | null;
  quantityMultiplier: string;
  isPrimary: boolean;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  price: number | string;
  costPrice?: number | string;
  quantity: number;
  barcode?: string | null;
  sourceBarcode?: string | null;
  description?: string | null;
  isActive?: boolean;
  category: ProductCategory | null;
  supplier: ProductSupplier | null;
  image_available: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface ProductStockMovementSummary {
  id: string;
  quantity: number;
  movementType: string;
  date: string;
  saleId: string | null;
}

export interface ProductDetail extends Product {
  costPrice: number | string;
  isActive: boolean;
  updatedAt: string;
  barcodes: ProductBarcodeItem[];
  recentMovements: ProductStockMovementSummary[];
}

export interface ProductsResponse {
  products: Product[];
  pagination: Pagination;
}

export interface CreateProductRequest {
  name: string;
  sourceBarcode?: string;
  barcode?: string;
  price: number | string;
  costPrice?: number | string;
  quantity?: number;
  categoryId?: string | null;
  supplierId?: string | null;
  description?: string;
}

export interface UpdateProductRequest {
  name?: string;
  price?: number | string;
  costPrice?: number | string;
  categoryId?: string | null;
  supplierId?: string | null;
  description?: string;
  isActive?: boolean;
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

export interface BulkBarcodeItem {
  id: string;
  productId: string;
  productName: string;
  categoryName: string | null;
  price: number;
  stock: number;
  barcode: string;
  barcodeType: string;
  unitId: string;
  quantityMultiplier: number;
  isPrimary: boolean;
}

export interface AllBarcodesResponse {
  barcodes: BulkBarcodeItem[];
}

// ---- Categories ------------------------------------------------------------

export interface Category {
  id: string;
  name: string;
  description: string;
  productCount: number;
  image_available: boolean;
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
  userId?: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  loyaltyPoints: number;
  ordersCount: number;
  is_active: boolean;
  createdAt: string;
}

export interface CustomersResponse {
  customers: Customer[];
  pagination: Pagination;
}

export interface CustomerSaleSummary {
  id: string;
  grandTotal: number;
  paymentMethod: string;
  paymentStatus: string;
  status: string;
  itemsCount: number;
  createdAt: string;
}

export interface CustomerDetail {
  id: string;
  userId: string;
  username: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  loyaltyPoints: number;
  isActive: boolean;
  createdAt: string;
  totalSpent: number;
  ordersCount: number;
  sales: CustomerSaleSummary[];
}

// ---- Suppliers -------------------------------------------------------------

export interface Supplier {
  id: string;
  companyName: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  productsCount: number;
  lowStockCount: number;
  is_active: boolean;
  createdAt: string;
}

export interface SuppliersResponse {
  suppliers: Supplier[];
  pagination: Pagination;
}

export interface SupplierProductSummary {
  id: string;
  name: string;
  barcode: string;
  category: string | null;
  price: number;
  costPrice: number;
  quantity: number;
  isActive: boolean;
}

export interface SupplierDetail {
  id: string;
  userId: string;
  companyName: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  isActive: boolean;
  createdAt: string;
  products: SupplierProductSummary[];
  lowStockProducts: SupplierProductSummary[];
}

// ---- Users -----------------------------------------------------------------

export interface User {
  id: string;
  username: string;
  email: string;
  phone: string;
  full_name: string;
  address?: string;
  role: string;
  is_active: boolean;
  lastLogin?: string | null;
  createdAt: string;
}

export interface UsersResponse {
  users: User[];
  pagination: Pagination;
}

// ---- Sales -----------------------------------------------------------------

export interface SaleItem {
  id?: string;
  productId: string;
  productName: string;
  barcode?: string | null;
  price: number | string;
  quantity: number;
  lineTotal: number | string;
}

export interface Sale {
  id: string;
  customer: { id: string; name: string } | null;
  customerFullName?: string;
  customerEmail?: string;
  customerPhone?: string;
  itemsCount?: number;
  totalAmount: number | string;
  taxAmount: number | string;
  discount: number | string;
  grandTotal: number | string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  controlNumber?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SaleDetail {
  id: string;
  status: string;
  paymentMethod: string;
  paymentConfirmed: boolean;
  subtotal: number;
  taxAmount: number;
  discount: number;
  grandTotal: number;
  customerId: string | null;
  customerFullName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  deliveryLocation: string | null;
  createdAt: string;
  updatedAt: string;
  payment: {
    id: string;
    controlNumber: string;
    paymentMethod: string;
    status: string;
    confirmedBy: string | null;
    createdAt: string;
  } | null;
  items: SaleItem[];
}

export interface SalesResponse {
  sales: Sale[];
  pagination: Pagination;
}

// ---- Stock & Movements -----------------------------------------------------

export interface StockItem {
  productId: string;
  productName: string;
  barcode: string;
  category: { id: string; name: string } | null;
  quantity: number;
  price: number;
  costPrice: number;
  lowStockThreshold: number;
  reorderLevel: number;
}

export interface StockResponse {
  stock: StockItem[];
}

export interface StockAdjustmentRequest {
  barcode: string;
  movementType: "IN" | "OUT";
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

export interface StockMovementRow {
  id: string;
  productId: string;
  productName: string;
  barcode: string;
  category: string | null;
  movementType: string;
  quantity: number;
  saleId: string | null;
  date: string;
}

export interface StockMovementsResponse {
  movements: StockMovementRow[];
  summary: {
    totalIn: number;
    totalOut: number;
    netChange: number;
  };
  pagination: Pagination;
}

// ---- Payments --------------------------------------------------------------

export interface Payment {
  id: string;
  saleId: string;
  controlNumber: string;
  amount: number;
  paymentMethod: string;
  status: string;
  customerName: string;
  saleStatus: string;
  confirmedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentsResponse {
  payments: Payment[];
  summary: {
    totalConfirmedAmount: number;
    confirmedCount: number;
    pendingAmount: number;
    pendingCount: number;
  };
  pagination: Pagination;
}

// ---- Reports (Z-Report & Profit Analytics) ---------------------------------

export interface ReportsResponse {
  generatedAt: string;
  timeZone: string;
  range: DashboardRangeSummary;
  financials: {
    grossRevenue: number;
    subtotalRevenue: number;
    taxCollected: number;
    discountsGiven: number;
    costOfGoodsSold: number;
    grossProfit: number;
    grossMarginPercent: number;
    confirmedOrders: number;
    cancelledOrders: number;
    averageOrderValue: number;
    unitsSold: number;
  };
  paymentBreakdown: Array<{
    method: string;
    orders: number;
    amount: number;
    share: number;
  }>;
  topProfitProducts: Array<{
    productId: string;
    name: string;
    barcode: string;
    unitsSold: number;
    revenue: number;
    cogs: number;
    profit: number;
    marginPercent: number;
  }>;
  slowMovingProducts: Array<{
    productId: string;
    name: string;
    barcode: string;
    category: string | null;
    stock: number;
    stockValue: number;
    unitsSold: number;
  }>;
}

// ---- System Diagnostics (Settings) -----------------------------------------

export interface SystemInfoResponse {
  timeZone: string;
  smtpConfigured: boolean;
  nodeEnv: string;
  defaultTaxRatePercent: number;
  defaultLowStockThreshold: number;
  defaultReorderLevel: number;
  databaseConnected: boolean;
}

// ---- Dashboard -------------------------------------------------------------

export interface DashboardStats {
  totalSalesToday: number;
  totalSalesWeek: number;
  totalSalesMonth: number;
  lowStockCount: number;
  pendingPayments: number;
  totalCustomers: number;
  totalProducts: number;
}

export type DashboardRange = "today" | "week" | "month" | "year";

export interface DashboardMetricDelta {
  current: number;
  previous: number;
  change: number;
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

export interface DashboardDepartmentSummary {
  id: string;
  code: string;
  name: string;
  shelvesCount: number;
  productCount: number;
  totalUnits: number;
  lowStockCount: number;
  outOfStockCount: number;
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
  /** Optional Phase 11 Digital Twin operational rollups (real DB queries). */
  operations?: {
    expiringSoonCount: number;
    expiredCount: number;
    pendingPurchaseOrdersCount: number;
    warehouseUnitsTotal: number;
    departmentPerformance: DashboardDepartmentSummary[];
  };
}

export type DashboardResponse = DashboardOverview;

// ---- Digital Twin, Departments, Shelves, Warehouse, POs, GRN & Batches -----

export interface DepartmentSummary {
  id: string;
  storeId: string;
  storeName: string;
  code: string;
  name: string;
  description: string;
  status: string;
  shelvesCount: number;
  productCount: number;
  totalUnits: number;
  lowStockCount: number;
  outOfStockCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ShelfRecord {
  id: string;
  shelfCode: string;
  shelfName: string;
  fixtureKind: string;
  capacity: number;
  status: string;
  department: { id: string; code: string; name: string };
  totalUnits: number;
  positions: Array<{
    id: string;
    positionCode: string;
    slotIndex: number;
    quantity: number;
    maximumCapacity: number;
    reservedQuantity: number;
    reorderLevel: number;
    product: {
      id: string;
      name: string;
      sku: string | null;
      barcode: string;
      price: number;
      totalStock: number;
      categoryName: string | null;
    } | null;
  }>;
}

export interface WarehouseLocationRecord {
  id: string;
  warehouseCode: string;
  zoneCode: string;
  rackCode: string;
  levelCode: string;
  positionCode: string;
  locationType: string;
  capacity: number;
  status: string;
  totalUnits: number;
  items: Array<{
    inventoryId: string;
    productId: string;
    productName: string;
    sku: string | null;
    barcode: string;
    categoryName: string | null;
    quantityOnHand: number;
    reservedQuantity: number;
    reorderLevel: number;
    totalProductStock: number;
  }>;
}

export interface WarehouseOverviewResponse {
  zones: Array<{
    zoneCode: string;
    racksCount: number;
    totalUnits: number;
    capacity: number;
  }>;
  locations: WarehouseLocationRecord[];
  migrationRequired?: boolean;
}

export interface PurchaseOrderRecord {
  id: string;
  orderNumber: string;
  status: string;
  supplierId: string;
  supplierName: string;
  totalAmount: number;
  expectedDate: string | null;
  notes: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  receiptsCount: number;
  items: Array<{
    id: string;
    productId: string;
    productName: string;
    barcode: string;
    orderedQuantity: number;
    receivedQuantity: number;
    remainingQuantity: number;
    unitCost: number;
    lineTotal: number;
  }>;
}

export interface GoodsReceiptRecord {
  id: string;
  receiptNumber: string;
  purchaseOrderId: string | null;
  orderNumber: string | null;
  supplierName: string;
  receivedBy: string;
  warehouseLocation: string | null;
  notes: string | null;
  receivedAt: string;
}

export interface InventoryBatchRecord {
  id: string;
  productId: string;
  productName: string;
  barcode: string;
  batchNumber: string;
  quantity: number;
  expiryDate: string | null;
  receivedDate: string;
  status: string;
  isExpired: boolean;
  isExpiringSoon: boolean;
  warehouseLocation: string | null;
}

// ---- Request options -------------------------------------------------------

export interface ListOptions {
  search?: string;
  categoryId?: string;
  supplierId?: string;
  status?: string;
  method?: string;
  type?: string;
  role?: string;
  productId?: string;
  lowStock?: boolean;
  includeInactive?: boolean;
  start?: string;
  end?: string;
  page?: number;
  take?: number;
}
