// Receipt generation.
// Produces a printable receipt for email and API responses.

export interface ReceiptItem {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  lineTotal: number;
}

export interface GenerateReceiptInput {
  saleId: string;
  customerFullName: string;
  customerEmail: string;
  items: ReceiptItem[];
  subtotal: number;
  taxAmount: number;
  grandTotal: number;
  paymentMethod: string;
  paymentStatus: string;
  createdAt: Date;
}

export function generateReceipt(data: GenerateReceiptInput): string {
  const lines: string[] = [];
  lines.push("=".repeat(52));
  lines.push("        OFFICIAL CUSTOMER RECEIPT");
  lines.push("=".repeat(52));
  lines.push(`Receipt #: ${data.saleId}`);
  lines.push(`Date: ${data.createdAt.toLocaleString()}`);
  lines.push("");
  lines.push(`Customer: ${data.customerFullName}`);
  lines.push(`Email: ${data.customerEmail}`);
  lines.push("");
  lines.push(`Payment: ${data.paymentMethod} (${data.paymentStatus})`);
  lines.push("");
  lines.push("PAID PRODUCTS");
  lines.push("-".repeat(52));
  lines.push(
    `${"Product".padEnd(32)} ${"Qty".padStart(6)} ${"Price".padStart(12)} ${"Total".padStart(12)}`
  );
  for (const item of data.items) {
    lines.push(
      `${item.productName.padEnd(32)} ${String(item.quantity).padStart(6)} $${String(item.price).padStart(11, "0")} $${String(item.lineTotal).padStart(11, "0")}`
    );
  }
  lines.push("-".repeat(52));
  lines.push(`${"Subtotal".padEnd(46)} $${String(data.subtotal).padStart(11, "0")}`);
  lines.push(`${"Tax (15%)".padEnd(46)} $${String(data.taxAmount).padStart(11, "0")}`);
  lines.push("-".repeat(52));
  lines.push(`${"Grand Total".padEnd(46)} $${String(data.grandTotal).padStart(11, "0")}`);
  lines.push("");
  lines.push("=".repeat(52));
  lines.push("Thank you for shopping with Supermarket Zanzibar!");
  lines.push("=".repeat(52));
  return lines.join("\n");
}
