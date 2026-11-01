"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface TableProps extends React.HTMLAttributes<HTMLTableElement> {}
export const Table = React.forwardRef<HTMLTableElement, TableProps>(
  function Table({ className, ...props }, ref) {
    return (
      <div className="w-full overflow-auto rounded-lg border border-border">
        <table
          ref={ref}
          className={cn("w-full text-sm", className)}
          {...props}
        />
      </div>
    );
  },
);
Table.displayName = "Table";

export interface TableHeaderProps extends React.HTMLAttributes<HTMLTableSectionElement> {}
export const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  TableHeaderProps
>(
  function TableHeader({ className, ...props }, ref) {
    return (
      <thead
        ref={ref}
        className={cn("bg-background/50", className)}
        {...props}
      />
    );
  },
);
TableHeader.displayName = "TableHeader";

export interface TableBodyProps extends React.HTMLAttributes<HTMLTableSectionElement> {}
export const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  TableBodyProps
>(
  function TableBody({ className, ...props }, ref) {
    return (
      <tbody ref={ref} className={cn("divide-y divide-border", className)} {...props} />
    );
  },
);
TableBody.displayName = "TableBody";

export interface TableFooterProps extends React.HTMLAttributes<HTMLTableSectionElement> {}
export const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  TableFooterProps
>(
  function TableFooter({ className, ...props }, ref) {
    return (
      <tfoot
        ref={ref}
        className={cn("bg-background border-t border-border font-medium", className)}
        {...props}
      />
    );
  },
);
TableFooter.displayName = "TableFooter";

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {}
export const TableRow = React.forwardRef<HTMLTableRowElement, TableRowProps>(
  function TableRow({ className, ...props }, ref) {
    return (
      <tr
        ref={ref}
        className={cn(
          "transition-colors hover:bg-accent/5 data-[selected]:bg-accent/10",
          className,
        )}
        {...props}
      />
    );
  },
);
TableRow.displayName = "TableRow";

export interface TableHeadProps extends React.HTMLAttributes<HTMLTableCellElement> {}
export const TableHead = React.forwardRef<HTMLTableCellElement, TableHeadProps>(
  function TableHead({ className, ...props }, ref) {
    return (
      <th
        ref={ref}
        className={cn(
          "h-11 px-4 text-left text-xs font-semibold text-muted uppercase tracking-wider",
          className,
        )}
        {...props}
      />
    );
  },
);
TableHead.displayName = "TableHead";

export interface TableCellProps extends React.HTMLAttributes<HTMLTableCellElement> {}
export const TableCell = React.forwardRef<HTMLTableCellElement, TableCellProps>(
  function TableCell({ className, ...props }, ref) {
    return (
      <td
        ref={ref}
        className={cn("p-4 align-middle", className)}
        {...props}
      />
    );
  },
);
TableCell.displayName = "TableCell";

export interface TableCaptionProps
  extends React.HTMLAttributes<HTMLTableCaptionElement> {}
export const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  TableCaptionProps
>(
  function TableCaption({ className, ...props }, ref) {
    return (
      <caption
        ref={ref}
        className={cn("mt-4 text-sm text-muted", className)}
        {...props}
      />
    );
  },
);
TableCaption.displayName = "TableCaption";
