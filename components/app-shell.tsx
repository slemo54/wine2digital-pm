"use client";

import { ReactNode, useMemo } from "react";
import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";

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
    <div className="min-h-screen bg-secondary text-foreground">
      <div className="flex min-h-screen">
        <AppSidebar />
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}


