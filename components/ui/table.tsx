"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type TableProps = React.HTMLAttributes<HTMLTableElement>;
export const Table = React.forwardRef<HTMLTableElement, TableProps>(
  function Table({ className, ...props }, ref) {
    return (
      <div className="w-full overflow-auto rounded-2xl border border-border/80 bg-white">
        <table
          ref={ref}
          className={cn("w-full min-w-[640px] text-sm sm:min-w-full", className)}
          {...props}
        />
      </div>
    );
  },
);
Table.displayName = "Table";

export type TableHeaderProps = React.HTMLAttributes<HTMLTableSectionElement>;
export const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  TableHeaderProps
>(function TableHeader({ className, ...props }, ref) {
  return (
    <thead
      ref={ref}
      className={cn("border-b border-border bg-surface-subtle/90", className)}
      {...props}
    />
  );
});
TableHeader.displayName = "TableHeader";

export type TableBodyProps = React.HTMLAttributes<HTMLTableSectionElement>;
export const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  TableBodyProps
>(function TableBody({ className, ...props }, ref) {
  return (
    <tbody
      ref={ref}
      className={cn("divide-y divide-border/70 bg-white", className)}
      {...props}
    />
  );
});
TableBody.displayName = "TableBody";

export type TableFooterProps = React.HTMLAttributes<HTMLTableSectionElement>;
export const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  TableFooterProps
>(function TableFooter({ className, ...props }, ref) {
  return (
    <tfoot
      ref={ref}
      className={cn(
        "border-t border-border bg-surface-subtle/60 font-medium",
        className,
      )}
      {...props}
    />
  );
});
TableFooter.displayName = "TableFooter";

export type TableRowProps = React.HTMLAttributes<HTMLTableRowElement>;
export const TableRow = React.forwardRef<HTMLTableRowElement, TableRowProps>(
  function TableRow({ className, ...props }, ref) {
    return (
      <tr
        ref={ref}
        className={cn(
          "transition-colors hover:bg-surface-subtle/75 data-[selected]:bg-teal-50/70",
          className,
        )}
        {...props}
      />
    );
  },
);
TableRow.displayName = "TableRow";

export type TableHeadProps = React.HTMLAttributes<HTMLTableCellElement>;
export const TableHead = React.forwardRef<HTMLTableCellElement, TableHeadProps>(
  function TableHead({ className, ...props }, ref) {
    return (
      <th
        ref={ref}
        className={cn(
          "h-11 px-4 text-left font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-teal-900/75",
          className,
        )}
        {...props}
      />
    );
  },
);
TableHead.displayName = "TableHead";

export type TableCellProps = React.TdHTMLAttributes<HTMLTableCellElement>;
export const TableCell = React.forwardRef<HTMLTableCellElement, TableCellProps>(
  function TableCell({ className, ...props }, ref) {
    return (
      <td
        ref={ref}
        className={cn("px-4 py-3.5 align-middle text-foreground", className)}
        {...props}
      />
    );
  },
);
TableCell.displayName = "TableCell";

export type TableCaptionProps = React.HTMLAttributes<HTMLTableCaptionElement>;
export const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  TableCaptionProps
>(function TableCaption({ className, ...props }, ref) {
  return (
    <caption
      ref={ref}
      className={cn("mt-4 text-sm text-muted", className)}
      {...props}
    />
  );
});
TableCaption.displayName = "TableCaption";
