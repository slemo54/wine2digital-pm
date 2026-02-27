"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Shield } from "lucide-react";
import { DEPARTMENTS } from "@/lib/departments";
import { useAdminUsers, useUpdateAdminUser } from "@/hooks/use-admin";

const UNASSIGNED_DEPARTMENT_VALUE = "__unassigned__";

type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  department: string | null;
  role: string;
  isActive: boolean;
  calendarEnabled: boolean;
  disabledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function displayName(u: AdminUser): string {
  const name = (u.name || `${u.firstName || ""} ${u.lastName || ""}`.trim()).trim();
  return name || u.email;
}

export default function AdminUsersPage() {
  const { data: session, status } = useSession() || {};
  const router = useRouter();

  const role = (session?.user as any)?.role as string | undefined;
  const isAdmin = role === "admin";

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");

  // Debounce search query to 500ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQ(q);
    }, 500);
    return () => clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/login");
  }, [status, router]);

  const filters = useMemo(() => ({
    q: debouncedQ.trim() || undefined,
    role: roleFilter !== "all" ? roleFilter : undefined,
    active: activeFilter !== "all" ? activeFilter : undefined,
  }), [debouncedQ, roleFilter, activeFilter]);

  const { data, isLoading, refetch } = useAdminUsers(filters);
  const updateMutation = useUpdateAdminUser();

  const users = useMemo(() => {
    if (!data?.users) return [];
    // Map the API response to match our local AdminUser type
    return data.users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      firstName: null,
      lastName: null,
      department: u.department,
      role: u.role,
      isActive: u.active,
      calendarEnabled: false, // Default value as API doesn't return this
      disabledAt: null,
      createdAt: u.createdAt,
      updatedAt: u.createdAt,
    })) as AdminUser[];
  }, [data]);

  const updateUser = async (id: string, patch: { role?: string; isActive?: boolean; department?: string | null; calendarEnabled?: boolean }) => {
    // Map our patch to match the API expectations
    const apiPatch: Partial<{ role: string; active: boolean; department: string | null; calendarEnabled: boolean }> = {};
    if (patch.role !== undefined) apiPatch.role = patch.role;
    if (patch.isActive !== undefined) apiPatch.active = patch.isActive;
    if (patch.department !== undefined) apiPatch.department = patch.department;
    if (patch.calendarEnabled !== undefined) apiPatch.calendarEnabled = patch.calendarEnabled;

    updateMutation.mutate({ id, data: apiPatch });
  };

  const header = useMemo(() => {
    return (
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-5 w-5" /> Admin · Utenti
          </h1>
          <p className="text-sm text-muted-foreground">Gestione utenti, ruoli e abilitazione account.</p>
        </div>
      </div>
    );
  }, []);

  if (status === "loading") {
    return (
      <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-secondary">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-secondary">
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">Accesso negato.</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] bg-secondary">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <Card>
          <CardHeader className="pb-4">{header}</CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-5">
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca per email/nome…" />
              </div>
              <div className="md:col-span-3">
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Ruolo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutti i ruoli</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="member">Member</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-3">
                <Select value={activeFilter} onValueChange={setActiveFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Stato" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutti</SelectItem>
                    <SelectItem value="true">Attivi</SelectItem>
                    <SelectItem value="false">Disattivati</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-1">
                <Button variant="outline" onClick={() => refetch()}>
                  Aggiorna
                </Button>
              </div>
            </div>

            {isLoading ? (
              <div className="py-8 flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Caricamento…
              </div>
            ) : (
              <div className="border rounded-md overflow-hidden">
                <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/50">
                  <div className="col-span-4">Utente</div>
                  <div className="col-span-2">Ruolo</div>
                  <div className="col-span-3">Reparto</div>
                  <div className="col-span-1 text-center">Calendario</div>
                  <div className="col-span-1 text-center">Attivo</div>
                  <div className="col-span-1 text-right">Azioni</div>
                </div>
                <div className="divide-y">
                  {users.map((u) => (
                    <div
                      key={u.id}
                      className="px-4 py-3 flex flex-col gap-3 md:grid md:grid-cols-12 md:gap-3 md:items-center"
                    >
                      <div className="min-w-0 md:col-span-4">
                        <div className="font-medium truncate">{displayName(u)}</div>
                        <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                      </div>

                      <div className="md:col-span-2">
                        <div className="text-xs text-muted-foreground md:hidden mb-1">Ruolo</div>
                        <Select value={u.role} onValueChange={(v) => updateUser(u.id, { role: v })}>
                          <SelectTrigger className="h-9 w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">admin</SelectItem>
                            <SelectItem value="manager">manager</SelectItem>
                            <SelectItem value="member">member</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="md:col-span-3">
                        <div className="text-xs text-muted-foreground md:hidden mb-1">Reparto</div>
                        {(() => {
                          const current = (u.department || "").trim();
                          const isKnown = (DEPARTMENTS as readonly string[]).includes(current);
                          const value = isKnown ? current : UNASSIGNED_DEPARTMENT_VALUE;
                          return (
                            <div>
                              <Select
                                value={value}
                                onValueChange={(v) =>
                                  updateUser(u.id, { department: v === UNASSIGNED_DEPARTMENT_VALUE ? null : v })
                                }
                              >
                                <SelectTrigger className="h-9 w-full">
                                  <SelectValue placeholder="Seleziona reparto" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={UNASSIGNED_DEPARTMENT_VALUE}>Non assegnato</SelectItem>
                                  {DEPARTMENTS.map((d) => (
                                    <SelectItem key={d} value={d}>
                                      {d}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {!isKnown && current ? (
                                <div className="mt-1 text-[11px] text-muted-foreground">Attuale (non standard): {current}</div>
                              ) : null}
                            </div>
                          );
                        })()}
                      </div>

                      <div className="md:col-span-1 flex flex-col items-center">
                        <div className="text-xs text-muted-foreground md:hidden mb-1">Calendario</div>
                        <Switch
                          checked={u.calendarEnabled}
                          onCheckedChange={(v) => updateUser(u.id, { calendarEnabled: v })}
                        />
                      </div>

                      <div className="md:col-span-1 flex flex-col items-center">
                        <div className="text-xs text-muted-foreground md:hidden mb-1">Attivo</div>
                        <Switch checked={u.isActive} onCheckedChange={(v) => updateUser(u.id, { isActive: v })} />
                      </div>

                      <div className="md:col-span-1 md:text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full md:w-auto"
                          onClick={() => router.push(`/admin/audit?entityId=${u.id}`)}
                        >
                          Audit
                        </Button>
                      </div>
                    </div>
                  ))}
                  {users.length === 0 ? (
                    <div className="p-6 text-sm text-muted-foreground">Nessun utente trovato.</div>
                  ) : null}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
