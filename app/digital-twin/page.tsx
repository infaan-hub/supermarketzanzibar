"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { DigitalTwinWorkspace } from "@/components/digital-twin/DigitalTwinWorkspace";
import type { TwinSceneScope } from "@/types/digital-twin";

function DigitalTwinPageInner() {
  const params = useSearchParams();
  const rawScope = params.get("scope");
  const initialScope: TwinSceneScope =
    rawScope === "warehouse" || rawScope === "supermarket"
      ? rawScope
      : "combined";

  return (
    <DigitalTwinWorkspace
      initialScope={initialScope}
      initialDepartment={params.get("dept")}
      initialShelfCode={params.get("shelf")}
      initialSearch={params.get("q")}
    />
  );
}

export default function DigitalTwinPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex h-full w-full items-center justify-center bg-[#f2fbfa]">
          <p className="text-sm font-medium text-teal-900">
            Preparing 3D Digital Twin Supermarket…
          </p>
        </div>
      }
    >
      <DigitalTwinPageInner />
    </React.Suspense>
  );
}
