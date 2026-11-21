"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_STORE_SETTINGS,
  SETTINGS_EVENT,
  readStoreSettings,
  resetStoreSettings,
  saveStoreSettings,
  type StoreSettings,
} from "@/lib/store-settings";

export function useStoreSettings() {
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_STORE_SETTINGS);

  useEffect(() => {
    const sync = () => setSettings(readStoreSettings());
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(SETTINGS_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(SETTINGS_EVENT, sync);
    };
  }, []);

  const update = (next: Partial<StoreSettings>) => {
    const saved = saveStoreSettings(next);
    setSettings(saved);
    return saved;
  };

  const reset = () => {
    const restored = resetStoreSettings();
    setSettings(restored);
    return restored;
  };

  return { settings, update, reset };
}
