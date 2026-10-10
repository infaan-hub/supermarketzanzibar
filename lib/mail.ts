// Email helper. Uses nodemailer with the SMTP settings from the environment.
// The original Django code sent order/receipt emails with fail_silently=True,
// so failures here are logged but never break the request.

import nodemailer from "nodemailer";

const host = process.env.SMTP_HOST || "";
const port = Number(process.env.SMTP_PORT || "587");
const user = process.env.SMTP_USER || "";
const pass = process.env.SMTP_PASSWORD || "";
const from = process.env.SMTP_FROM || "noreply@zansupermarket.local";

function transporter() {
  if (!host) return null;
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user ? { user, pass } : undefined,
  });
}

export async function sendOrderEmail(to: string, subject: string, message: string): Promise<void> {
  const recipient = (to || "").trim();
  if (!recipient) return;
  const tx = transporter();
  if (!tx) return;
  try {
    await tx.sendMail({ from, to: recipient, subject, text: message });
  } catch (error) {
    // Preserve Django's fail_silently behavior for transactional emails.
    console.error("Order email failed:", error instanceof Error ? error.message : error);
  }
}
