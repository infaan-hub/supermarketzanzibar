import { cn } from "@/lib/utils";
import type { StatusTone } from "@/lib/format";

const toneStyles: Record<StatusTone, string> = {
  success: "border-transparent bg-[#4CAF50] text-white shadow-sm",
  warning: "border-transparent bg-[#4CAF50]/80 text-white shadow-sm",
  danger: "border-transparent bg-[#e53935] text-white shadow-sm",
  secondary: "border-white/10 bg-[#3a3a40] text-[#e4e4e7]",
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
        "inline-flex items-center justify-center whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-semibold leading-4",
        toneStyles[tone],
        className,
      )}
    >
      {label}
    </span>
  );
}
