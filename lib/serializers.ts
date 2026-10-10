// Serializers that reproduce the exact JSON response shapes produced by the
// original Django REST Framework serializers. The frontend and any external
// API consumers depend on these field names and types.

import { prisma } from "@/lib/db";
import { moneyString } from "@/lib/money";
import { binaryDataUrl, barcodeDataUrl, paymentTicketId } from "@/lib/media";
import { scheduleStatus, hasActiveScheduledAccess } from "@/lib/auth/schedule";

function productImageUrl(productId: bigint): string {
  return `/api/products/${productId.toString()}/image/`;
}

type UserRow = {
  id: bigint;
  username: string;
  email: string;
  fullName: string;
  phone: string;
  address: string | null;
  role: string;
  isActive: boolean;
  accessWindowStart: Date | null;
  accessWindowEnd: Date | null;
  createdAt: Date;
  updatedAt: Date;
  profileImageData: Uint8Array | null;
  profileImageContentType: string | null;
};

export function serializeUser(user: UserRow) {
  return {
    id: user.id.toString(),
    username: user.username,
    email: user.email,
    full_name: user.fullName,
    phone: user.phone,
    address: user.address ?? "",
    profile_image_url: binaryDataUrl(user.profileImageData, user.profileImageContentType),
    role: user.role,
    is_active: user.isActive,
    access_window_start: user.accessWindowStart,
    access_window_end: user.accessWindowEnd,
    schedule_status: scheduleStatus(user),
    has_active_scheduled_access: hasActiveScheduledAccess(user),
    created_at: user.createdAt,
    updated_at: user.updatedAt,
  };
}

export function serializeScheduledAccess(user: UserRow) {
  return {
    id: user.id.toString(),
    username: user.username,
    email: user.email,
    full_name: user.fullName,
    phone: user.phone,
    role: user.role,
    is_active: user.isActive,
    access_window_start: user.accessWindowStart,
    access_window_end: user.accessWindowEnd,
    schedule_status: scheduleStatus(user),
    has_active_scheduled_access: hasActiveScheduledAccess(user),
  };
}

export function serializeCategory(c: {
  id: bigint;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: c.id.toString(),
    name: c.name,
    description: c.description,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  };
}

export function serializeSupplier(s: {
  id: bigint;
  companyName: string;
  phone: string;
  address: string;
  userId: bigint;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: s.id.toString(),
    company_name: s.companyName,
    phone: s.phone,
    address: s.address,
    user: s.userId.toString(),
    created_at: s.createdAt,
    updated_at: s.updatedAt,
  };
}

export function serializeCustomer(c: {
  id: bigint;
  phone: string;
  loyaltyPoints: number;
  userId: bigint;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: c.id.toString(),
    phone: c.phone,
    loyalty_points: c.loyaltyPoints,
    user: c.userId.toString(),
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  };
}
// ---- Products ----
type ProductRow = {
  id: bigint;
  name: string;
  slug: string;
  categoryId: bigint | null;
  category?: { id: bigint; name: string } | null;
  supplierId: bigint | null;
  price: unknown;
  costPrice: unknown;
  quantity: number;
  barcode: string;
  imageData: Uint8Array | null;
  description: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function categoryName(p: ProductRow): string | null {
  return p.category ? p.category.name : null;
}

export function serializePublicProduct(p: ProductRow) {
  const url = p.imageData ? productImageUrl(p.id) : null;
  return {
    id: p.id.toString(),
    name: p.name,
    slug: p.slug,
    price: moneyString(p.price as never),
    quantity: p.quantity,
    image: url,
    image_url: url,
    description: p.description,
    category_name: categoryName(p),
    updated_at: p.updatedAt,
  };
}

export function serializeProduct(p: ProductRow) {
  const url = p.imageData ? productImageUrl(p.id) : null;
  return {
    id: p.id.toString(),
    name: p.name,
    slug: p.slug,
    category: categoryName(p) ?? "",
    category_id: p.categoryId ? p.categoryId.toString() : null,
    category_name: categoryName(p),
    supplier: p.supplierId ? p.supplierId.toString() : null,
    price: moneyString(p.price as never),
    cost_price: moneyString(p.costPrice as never),
    quantity: p.quantity,
    barcode: p.barcode,
    image: url,
    image_url: url,
    description: p.description,
    is_active: p.isActive,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
}

export function serializeSaleItem(item: {
  id: bigint;
  saleId: bigint;
  productId: bigint;
  quantity: number;
  price: unknown;
  total: unknown;
  createdAt: Date;
  updatedAt: Date;
  product?: { name: string; imageData: Uint8Array | null } | null;
}) {
  return {
    id: item.id.toString(),
    sale: item.saleId.toString(),
    product: item.productId.toString(),
    quantity: item.quantity,
    price: moneyString(item.price as never),
    total: moneyString(item.total as never),
    created_at: item.createdAt,
    updated_at: item.updatedAt,
    product_name: item.product?.name ?? "",
    product_image_url: item.product?.imageData ? productImageUrl(item.productId) : null,
  };
}
// ---- Payments ----
type PaymentRow = {
  id: bigint;
  saleId: bigint;
  controlNumber: string;
  paymentMethod: string;
  status: string;
  confirmedById: bigint | null;
  createdAt: Date;
  updatedAt: Date;
  proofImageData: Uint8Array | null;
  proofImageContentType: string | null;
};

export function serializePayment(p: PaymentRow) {
  const ticket = paymentTicketId(p.controlNumber);
  return {
    id: p.id.toString(),
    sale: p.saleId.toString(),
    control_number: p.controlNumber,
    payment_method: p.paymentMethod,
    status: p.status,
    confirmed_by: p.confirmedById ? p.confirmedById.toString() : null,
    proof_image_url: binaryDataUrl(p.proofImageData, p.proofImageContentType),
    ticket_id: ticket,
    barcode_image_url: barcodeDataUrl(ticket),
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
}

export async function serializePaymentAdmin(p: PaymentRow) {
  const sale = await prisma.sale.findUnique({
    where: { id: p.saleId },
    include: { items: { include: { product: true } }, user: true },
  });
  const customerName = sale?.customerFullName || sale?.user?.fullName || "";
  return {
    id: p.id.toString(),
    control_number: p.controlNumber,
    status: p.status,
    payment_method: p.paymentMethod,
    created_at: p.createdAt,
    sale_id: sale ? sale.id.toString() : null,
    sale_status: sale?.status ?? null,
    sale_total: sale ? moneyString(sale.finalAmount as never) : "0.00",
    delivery_location: sale?.deliveryLocation ?? "",
    customer_name: customerName || "Customer",
    customer_email: sale?.customerEmail || sale?.user?.email || "",
    customer_phone: sale?.customerPhone || sale?.user?.phone || "",
    customer_address: sale?.customerAddress || sale?.user?.address || "",
    items: sale
      ? sale.items.map((it) => serializeSaleItem({ ...it, product: { name: it.product.name, imageData: it.product.imageData } }))
      : [],
  };
}

type SaleRow = {
  id: bigint;
  customerId: bigint | null;
  userId: bigint | null;
  totalAmount: unknown;
  tax: unknown;
  discount: unknown;
  finalAmount: unknown;
  paymentMethod: string;
  paymentConfirmed: boolean;
  termsAccepted: boolean;
  deliveryLocation: string | null;
  customerFullName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  assignedDriverId: bigint | null;
  status: string;
  customerHistoryHidden: boolean;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
  items?: Array<Parameters<typeof serializeSaleItem>[0]>;
  payment?: PaymentRow | null;
  user?: { fullName: string; email: string; phone: string; address: string | null } | null;
};

export function serializeSale(sale: SaleRow) {
  const payment = sale.payment ?? null;
  const confirmed = Boolean(payment && payment.status === "confirmed");
  const customerName = sale.customerFullName || sale.user?.fullName || "";
  return {
    id: sale.id.toString(),
    customer: sale.customerId ? sale.customerId.toString() : null,
    user: sale.userId ? sale.userId.toString() : null,
    total_amount: moneyString(sale.totalAmount as never),
    tax: moneyString(sale.tax as never),
    discount: moneyString(sale.discount as never),
    final_amount: moneyString(sale.finalAmount as never),
    payment_method: sale.paymentMethod,
    payment_confirmed: sale.paymentConfirmed,
    terms_accepted: sale.termsAccepted,
    delivery_location: sale.deliveryLocation ?? "",
customer_full_name: customerName || "Customer",
    customer_email: sale.customerEmail || sale.user?.email || "",
    customer_phone: sale.customerPhone || sale.user?.phone || "",
    customer_address: sale.customerAddress || sale.user?.address || "",
    receipt_available: confirmed,
    receipt_url: confirmed ? `/api/customer/orders/${sale.id.toString()}/receipt/` : null,
  };
}

export function serializeStock(s: {
  id: bigint;
  productId: bigint;
  saleItemId: bigint | null;
  quantity: number;
  movementType: string;
  date: Date;
  updatedAt: Date;
}) {
  return {
    id: s.id.toString(),
    product: s.productId.toString(),
    sale_item: s.saleItemId ? s.saleItemId.toString() : null,
    quantity: s.quantity,
    movement_type: s.movementType,
    date: s.date,
    updated_at: s.updatedAt,
  };
}

export { productImageUrl };
