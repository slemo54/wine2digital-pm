"use client";

import { Sheet, SheetContent } from "@/components/ui/sheet";

type SideDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  side?: "right" | "left" | "top" | "bottom";
  contentClassName?: string;
  overlayClassName?: string;
};

export function SideDrawer({
  open,
  onOpenChange,
  children,
  side = "right",
  contentClassName,
  overlayClassName,
}: SideDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={side} className={contentClassName} overlayClassName={overlayClassName}>
        {children}
      </SheetContent>
    </Sheet>
  );
}


