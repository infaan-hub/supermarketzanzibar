"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface LinkProps extends React.ComponentPropsWithoutRef<typeof Link> {
  asChild?: boolean;
}

function LinkComponent({
  asChild,
  className,
  children,
  ...props
}: LinkProps) {
  if (asChild) {
    return (
      <Link {...(props as React.ComponentPropsWithoutRef<typeof Link>)}>
        {children}
      </Link>
    );
  }

  return (
    <Link
      {...(props as React.ComponentPropsWithoutRef<typeof Link>)}
      className={cn(
        "text-primary hover:underline font-medium transition-colors",
        className,
      )}
    >
      {children}
    </Link>
  );
}

export default React.forwardRef<HTMLAnchorElement, LinkProps>(LinkComponent);
