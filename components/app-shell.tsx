"use client";

import { ReactNode, useMemo } from "react";
import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { CommandPalette } from "@/components/command-palette";
import { PerfOverlay } from "@/components/perf-overlay";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";

function shouldShowAppShell(pathname: string): boolean {
  if (!pathname) return false;
  if (pathname === "/") return false;
  if (pathname.startsWith("/auth")) return false;
  // keep invite join as focused page (no shell)
  if (pathname.startsWith("/invites/join")) return false;
  return true;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const show = useMemo(() => shouldShowAppShell(pathname || ""), [pathname]);

  if (!show) return <>{children}</>;

  return (
    <div className="min-h-screen min-h-[100dvh] bg-secondary text-foreground flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden border-b bg-background p-4 flex items-center justify-between sticky top-0 z-50">
        <div className="font-semibold text-lg flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center text-white text-xs font-bold">
            W
          </div>
          <span>Wine2Digital</span>
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72">
            <AppSidebar className="w-full border-none shadow-none sticky top-0 h-full" />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar */}
      <AppSidebar className="hidden md:block" />

      <main className="flex-1 min-w-0 flex flex-col min-h-screen min-h-[100dvh]">
        <div className="flex-1">
          {children}
        </div>
        <CommandPalette />
        <PerfOverlay />
        <footer className="py-2 text-center mt-auto border-t border-border/40">
          <p className="text-[10px] text-muted-foreground/40 font-mono">by Anselmo Acquah</p>
        </footer>
      </main>
    </div>
  );
}



