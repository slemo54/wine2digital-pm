"use client";

import type { ReactNode } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";

type SideDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  side?: "right" | "left" | "top" | "bottom";
  contentClassName?: string;
  overlayClassName?: string;
  hideClose?: boolean;
};

export function SideDrawer({
  open,
  onOpenChange,
  children,
  side = "right",
  contentClassName,
  overlayClassName,
  hideClose,
}: SideDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        className={contentClassName}
        overlayClassName={overlayClassName}
        hideClose={hideClose}
      >
        {children}
      </SheetContent>
    </Sheet>
  );
}


