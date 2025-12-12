"use client";

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
  LogOut,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive?: (pathname: string) => boolean;
};

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, isActive: (p) => p === "/dashboard" },
  { href: "/projects", label: "Progetti", icon: FolderKanban, isActive: (p) => p.startsWith("/projects") || p.startsWith("/project/") },
  { href: "/tasks", label: "Task", icon: CheckSquare, isActive: (p) => p.startsWith("/tasks") },
  { href: "/calendar", label: "Calendario", icon: CalendarDays, isActive: (p) => p.startsWith("/calendar") },
  { href: "/files", label: "File", icon: FileText, isActive: (p) => p.startsWith("/files") },
  { href: "/profile", label: "Profilo", icon: User, isActive: (p) => p.startsWith("/profile") },
];

function initials(name?: string | null, email?: string | null): string {
  const raw = (name || email || "U").trim();
  const parts = raw.split(" ").filter(Boolean);
  return ((parts[0]?.[0] || "U") + (parts[1]?.[0] || "")).toUpperCase();
}

export function AppSidebar() {
  const pathname = usePathname() || "";
  const router = useRouter();
  const { data: session } = useSession();

  return (
    <aside className="w-64 shrink-0 border-r border-border bg-background sticky top-0 h-screen">
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
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  active
                    ? "bg-accent text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
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


