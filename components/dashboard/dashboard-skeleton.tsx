import { Skeleton } from "@/components/ui/skeleton";

function PanelSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={`rounded-xl border border-border bg-background p-4 shadow-card sm:p-5 ${
        className ?? ""
      }`}
    >
      <Skeleton className="h-4 w-28" />
      <Skeleton className="mt-2 h-3 w-40" />
      <Skeleton className="mt-5 h-[220px] w-full" />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-[1400px] space-y-5 sm:space-y-6"
      role="status"
      aria-busy="true"
      aria-label="Loading dashboard"
    >
      <p className="sr-only">Loading dashboard…</p>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-2 h-8 w-64 max-w-full" />
          <Skeleton className="mt-2 h-4 w-80 max-w-full" />
        </div>
        <div className="sm:text-right">
          <Skeleton className="h-4 w-52 max-w-full sm:ml-auto" />
          <Skeleton className="mt-2 h-3 w-44 max-w-full sm:ml-auto" />
        </div>
      </div>

      <div className="flex flex-col gap-3 border-y border-border/70 py-3 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-8 w-full sm:w-64" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border shadow-card md:grid-cols-3 xl:grid-cols-6">
        {[1, 2, 3, 4, 5, 6].map((cell) => (
          <div key={cell} className="bg-background p-3.5 sm:p-4 xl:p-5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-3 h-6 w-24" />
            <Skeleton className="mt-2 h-3 w-28" />
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <PanelSkeleton className="h-[380px]" />
        <PanelSkeleton className="h-[380px]" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <PanelSkeleton className="h-[330px]" />
        <PanelSkeleton className="h-[330px]" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <PanelSkeleton className="h-[360px]" />
        <div className="space-y-5">
          <PanelSkeleton className="h-[260px]" />
          <PanelSkeleton className="h-[240px]" />
        </div>
      </div>
    </div>
  );
}
