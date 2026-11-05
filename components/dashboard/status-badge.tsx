import { cn } from "@/lib/utils";
import type { StatusTone } from "@/lib/format";

const toneStyles: Record<StatusTone, string> = {
  success: "border-success/20 bg-success-soft text-success",
  warning: "border-warning/20 bg-warning-soft text-warning",
  danger: "border-danger/20 bg-danger-soft text-danger",
  secondary: "border-border bg-surface-subtle text-muted",
};

export function StatusBadge({
  label,
  tone = "secondary",
  className,
}: {
  label: string;
  tone?: StatusTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4",
        toneStyles[tone],
        className,
      )}
    >
      {label}
    </span>
  );
}
