"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  CalendarDays,
  FileText,
  User,
  Shield,
  LogOut,
  Clock,
  Settings,
  Bell,
  Timer,
} from "lucide-react";
import { isClockifyEnabled } from "@/lib/feature-flags";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive?: (pathname: string) => boolean;
  hasBadge?: boolean;
};

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, isActive: (p) => p === "/dashboard" },
  { href: "/projects", label: "Progetti", icon: FolderKanban, isActive: (p) => p.startsWith("/projects") || p.startsWith("/project/") },
  { href: "/tasks", label: "Task", icon: CheckSquare, isActive: (p) => p.startsWith("/tasks") },
  { href: "/calendar", label: "Calendario", icon: CalendarDays, isActive: (p) => p.startsWith("/calendar") },
  ...(isClockifyEnabled()
    ? [{ href: "/clockify", label: "Clockify", icon: Timer, isActive: (p: string) => p.startsWith("/clockify") }]
    : []),
  { href: "/notifications", label: "Notifiche", icon: Bell, isActive: (p) => p.startsWith("/notifications"), hasBadge: true },
  { href: "/files", label: "File", icon: FileText, isActive: (p) => p.startsWith("/files") },
  { href: "/profile", label: "Profilo", icon: User, isActive: (p) => p.startsWith("/profile") },
];

function initials(name?: string | null, email?: string | null): string {
  const raw = (name || email || "U").trim();
  const parts = raw.split(" ").filter(Boolean);
  return ((parts[0]?.[0] || "U") + (parts[1]?.[0] || "")).toUpperCase();
}

interface AppSidebarProps {
  className?: string;
}

export function AppSidebar({ className }: AppSidebarProps) {
  const pathname = usePathname() || "";
  const router = useRouter();
  const { data: session, status } = useSession();
  const globalRole = (session?.user as any)?.role as string | undefined;
  const isAdmin = globalRole === "admin";
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;

    const refresh = () => {
      // Semplice fetch per il badge. In app reale usare SWR/React Query o Context.
      fetch("/api/notifications")
        .then((res) => res.json())
        .then((data) => {
          if (cancelled) return;
          setUnreadCount(data.unreadCount || 0);
        })
        .catch(() => {});
    };

    refresh();

    const onChanged = (ev: Event) => {
      const detail = (ev as any)?.detail;
      const next = detail?.unreadCount;
      if (typeof next === "number" && Number.isFinite(next)) {
        setUnreadCount(next);
        return;
      }
      refresh();
    };
    window.addEventListener("notifications:changed", onChanged as any);
    return () => {
      cancelled = true;
      window.removeEventListener("notifications:changed", onChanged as any);
    };
  }, [status, pathname]); // Aggiorna al cambio pagina

  return (
    <aside className={cn("w-64 shrink-0 border-r border-border bg-background sticky top-0 h-screen h-[100dvh]", className)}>
      <div className="h-full flex flex-col">
        <div className="px-4 py-4 border-b border-border flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white font-semibold">
              W
            </div>
            <span className="font-semibold">Wine2Digital</span>
          </Link>
          <ThemeToggle />
        </div>

        <nav className="p-3 space-y-1">
          {NAV.map((item) => {
            const active = item.isActive ? item.isActive(pathname) : pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors relative",
                  active
                    ? "bg-accent text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="flex-1">{item.label}</span>
                {item.hasBadge && unreadCount > 0 && (
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                )}
              </Link>
            );
          })}

          {isAdmin ? (
            <div className="pt-3">
              <div className="px-3 pb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Admin</div>
              <Link
                href="/admin/users"
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  pathname.startsWith("/admin/users") || pathname === "/admin"
                    ? "bg-accent text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                )}
              >
                <Shield className="h-4 w-4" />
                Utenti
              </Link>
              <Link
                href="/admin/absences"
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  pathname.startsWith("/admin/absences")
                    ? "bg-accent text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                )}
              >
                <Clock className="h-4 w-4" />
                Archivio richieste
              </Link>
              <Link
                href="/admin/settings"
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  pathname.startsWith("/admin/settings")
                    ? "bg-accent text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                )}
              >
                <Settings className="h-4 w-4" />
                Settings
              </Link>
            </div>
          ) : null}
        </nav>

        <div className="mt-auto p-4 border-t border-border">
          <div className="flex items-center gap-3 mb-3">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-primary text-white text-xs">
                {initials(session?.user?.name, session?.user?.email)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{session?.user?.name || "Utente"}</div>
              <div className="text-xs text-muted-foreground truncate">{session?.user?.email || ""}</div>
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => signOut({ callbackUrl: "/auth/login" })}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Esci
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start mt-2"
            onClick={() => router.push("/dashboard")}
          >
            Torna alla Dashboard
          </Button>
        </div>
      </div>
    </aside>
  );
}



