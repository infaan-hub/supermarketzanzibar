"use client";

import * as React from "react";

export function SelectionControls({
  onClearSelection,
}: {
  onClearSelection: () => void;
}) {
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClearSelection();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClearSelection]);

  return null;
}
