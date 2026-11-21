// Plain-text receipt generator for email notifications and API responses.

function formatTzs(amount: number): string {
  return new Intl.NumberFormat("en-TZ", {
    style: "currency",
    currency: "TZS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export interface ReceiptItem {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  lineTotal: number;
}

export interface GenerateReceiptInput {
  saleId: string;
  controlNumber?: string;
  customerFullName: string;
  customerEmail: string;
  items: ReceiptItem[];
  subtotal: number;
  discount?: number;
  taxAmount: number;
  taxRatePercent?: number;
  grandTotal: number;
  paymentMethod: string;
  paymentStatus: string;
  createdAt: Date;
}

export function generateReceipt(data: GenerateReceiptInput): string {
  const lines: string[] = [];
  const taxLabel = `Tax (${data.taxRatePercent ?? 15}%)`;
  lines.push("=".repeat(56));
  lines.push("            SUPERMARKET ZANZIBAR RECEIPT");
  lines.push("=".repeat(56));
  lines.push(`Receipt #: ${data.saleId}`);
  if (data.controlNumber) {
    lines.push(`Control #: ${data.controlNumber}`);
  }
  lines.push(`Date:      ${data.createdAt.toLocaleString("en-GB", { timeZone: "Africa/Dar_es_Salaam" })}`);
  lines.push("");
  lines.push(`Customer:  ${data.customerFullName || "Walk-in Customer"}`);
  if (data.customerEmail) {
    lines.push(`Email:     ${data.customerEmail}`);
  }
  lines.push(`Payment:   ${data.paymentMethod.replace("_", " ")} (${data.paymentStatus})`);
  lines.push("");
  lines.push("ITEMS");
  lines.push("-".repeat(56));
  lines.push(
    `${"Product".padEnd(28)} ${"Qty".padStart(4)} ${"Price".padStart(10)} ${"Total".padStart(11)}`,
  );
  for (const item of data.items) {
    lines.push(
      `${item.productName.slice(0, 28).padEnd(28)} ${String(item.quantity).padStart(4)} ${formatTzs(item.price).padStart(10)} ${formatTzs(item.lineTotal).padStart(11)}`,
    );
  }
  lines.push("-".repeat(56));
  lines.push(`${"Subtotal".padEnd(42)} ${formatTzs(data.subtotal).padStart(13)}`);
  if (data.discount && data.discount > 0) {
    lines.push(`${"Discount".padEnd(42)} ${`-${formatTzs(data.discount)}`.padStart(13)}`);
  }
  lines.push(`${taxLabel.padEnd(42)} ${formatTzs(data.taxAmount).padStart(13)}`);
  lines.push("-".repeat(56));
  lines.push(`${"Grand Total".padEnd(42)} ${formatTzs(data.grandTotal).padStart(13)}`);
  lines.push("");
  lines.push("=".repeat(56));
  lines.push("Thank you for shopping with Supermarket Zanzibar!");
  lines.push("=".repeat(56));
  return lines.join("\n");
}
