// GET /api/settings - System & store diagnostics for the Settings screen.

import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { json } from "@/lib/http";
import { requireStaff } from "@/lib/auth/request";
import { env } from "@/lib/env";
import { BUSINESS_TIME_ZONE } from "@/lib/timezone";
import { LOW_STOCK_THRESHOLD, REORDER_LEVEL } from "@/lib/inventory";
import { DEFAULT_STORE_SETTINGS } from "@/lib/store-settings";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const guard = await requireStaff(request);
  if (!guard.ok) return guard.response;

  let databaseConnected = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    databaseConnected = true;
  } catch {
    databaseConnected = false;
  }

  return json({
    timeZone: BUSINESS_TIME_ZONE,
    smtpConfigured: env.smtpConfigured,
    nodeEnv: env.nodeEnv,
    defaultTaxRatePercent: DEFAULT_STORE_SETTINGS.taxRatePercent,
    defaultLowStockThreshold: LOW_STOCK_THRESHOLD,
    defaultReorderLevel: REORDER_LEVEL,
    databaseConnected,
  });
}
