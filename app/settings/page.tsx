// Store & POS Settings page (`/settings`, admin only).
//
// Configures receipt headers, TIN/VAT number, live POS tax rate %, low-stock
// thresholds, and thermal paper width, alongside live backend health diagnostics.

"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { fetchSystemInfo } from "@/lib/api";
import type { ReceiptPaperWidth } from "@/lib/store-settings";
import type { SystemInfoResponse } from "@/types/api";

export default function SettingsPage() {
  const { settings, update, reset } = useStoreSettings();
  const [sysInfo, setSysInfo] = useState<SystemInfoResponse | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const [storeName, setStoreName] = useState(settings.storeName);
  const [storeTagline, setStoreTagline] = useState(settings.storeTagline);
  const [storePhone, setStorePhone] = useState(settings.storePhone);
  const [storeAddress, setStoreAddress] = useState(settings.storeAddress);
  const [taxNumber, setTaxNumber] = useState(settings.taxNumber);
  const [taxRatePercent, setTaxRatePercent] = useState(
    String(settings.taxRatePercent),
  );
  const [lowStockThreshold, setLowStockThreshold] = useState(
    String(settings.lowStockThreshold),
  );
  const [reorderLevel, setReorderLevel] = useState(
    String(settings.reorderLevel),
  );
  const [receiptWidth, setReceiptWidth] = useState<ReceiptPaperWidth>(
    settings.receiptWidth,
  );
  const [receiptFooter, setReceiptFooter] = useState(settings.receiptFooter);

  useEffect(() => {
    setStoreName(settings.storeName);
    setStoreTagline(settings.storeTagline);
    setStorePhone(settings.storePhone);
    setStoreAddress(settings.storeAddress);
    setTaxNumber(settings.taxNumber);
    setTaxRatePercent(String(settings.taxRatePercent));
    setLowStockThreshold(String(settings.lowStockThreshold));
    setReorderLevel(String(settings.reorderLevel));
    setReceiptWidth(settings.receiptWidth);
    setReceiptFooter(settings.receiptFooter);
  }, [settings]);

  useEffect(() => {
    fetchSystemInfo()
      .then(setSysInfo)
      .catch(() => undefined);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    update({
      storeName,
      storeTagline,
      storePhone,
      storeAddress,
      taxNumber,
      taxRatePercent: Number(taxRatePercent),
      lowStockThreshold: Number(lowStockThreshold),
      reorderLevel: Number(reorderLevel),
      receiptWidth,
      receiptFooter,
    });
    setSavedNotice("Store & POS settings saved.");
  };

  const handleReset = () => {
    reset();
    setSavedNotice("Settings restored to defaults.");
  };

  return (
    <div className="mx-auto max-w-[1160px] space-y-6">
      <PageHeader
        title="Store & POS Settings"
        description="Configure receipt branding, VAT rate, thermal paper width, and inventory alert thresholds."
      />

      {savedNotice && (
        <div
          role="status"
          className="rounded-lg border border-success/25 bg-success/10 px-4 py-3 text-sm text-success"
        >
          {savedNotice}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Business &amp; Receipt Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Store Name</label>
                  <Input
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Tagline</label>
                  <Input
                    value={storeTagline}
                    onChange={(e) => setStoreTagline(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Store Phone</label>
                  <Input
                    value={storePhone}
                    onChange={(e) => setStorePhone(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">TIN / VAT ID</label>
                  <Input
                    placeholder="e.g. 123-456-789"
                    value={taxNumber}
                    onChange={(e) => setTaxNumber(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Store Address</label>
                <Input
                  value={storeAddress}
                  onChange={(e) => setStoreAddress(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Tax Rate (%)</label>
                  <Input
                    type="number"
                    min={0}
                    max={50}
                    step="0.5"
                    value={taxRatePercent}
                    onChange={(e) => setTaxRatePercent(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Low Stock Alert</label>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={lowStockThreshold}
                    onChange={(e) => setLowStockThreshold(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Reorder Level</label>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={reorderLevel}
                    onChange={(e) => setReorderLevel(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Receipt Width</label>
                  <Select
                    value={receiptWidth}
                    onChange={(e) =>
                      setReceiptWidth(e.target.value as ReceiptPaperWidth)
                    }
                  >
                    <option value="80mm">80mm Thermal</option>
                    <option value="58mm">58mm Compact</option>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Receipt Footer</label>
                <Input
                  value={receiptFooter}
                  onChange={(e) => setReceiptFooter(e.target.value)}
                />
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <Button type="submit">Save Settings</Button>
                <Button type="button" variant="secondary" onClick={handleReset}>
                  Restore Defaults
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Diagnostics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted">Neon PostgreSQL</span>
              <Badge
                variant={sysInfo?.databaseConnected ? "success" : "warning"}
              >
                {sysInfo
                  ? sysInfo.databaseConnected
                    ? "Connected"
                    : "Unavailable"
                  : "Checking…"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted">Email (SMTP)</span>
              <Badge variant={sysInfo?.smtpConfigured ? "success" : "secondary"}>
                {sysInfo?.smtpConfigured ? "Configured" : "Console fallback"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted">Business Timezone</span>
              <span className="font-mono text-xs">
                {sysInfo?.timeZone ?? "Africa/Dar_es_Salaam"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted">Currency</span>
              <span className="font-mono text-xs">TZS (Tanzanian Shilling)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted">Runtime</span>
              <span className="font-mono text-xs">
                {sysInfo?.nodeEnv ?? "production"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
