"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, UserPlus, Link2, Copy, Trash2, Shield } from "lucide-react";
import { toast } from "react-hot-toast";
import { canManageProjectMembers } from "@/lib/project-permissions";
import { useUsersList } from "@/hooks/use-users-list";

type Member = {
  id: string;
  role: string;
  userId: string;
  user: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    name?: string | null;
    image?: string | null;
    role?: string | null;
  };
};

type UserLite = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  role?: string | null;
};

function displayName(u: { firstName?: string | null; lastName?: string | null; name?: string | null; email: string }) {
  const full = (u.name || `${u.firstName || ""} ${u.lastName || ""}`.trim()).trim();
  return full || u.email;
}

function initials(u: { firstName?: string | null; lastName?: string | null; name?: string | null; email: string }) {
  const base = displayName(u);
  const parts = base.split(" ").filter(Boolean);
  return ((parts[0]?.[0] || "U") + (parts[1]?.[0] || "")).toUpperCase();
}

export function ProjectMembersPanel(props: {
  projectId: string;
  members: Member[];
  sessionUserId?: string | null;
  sessionGlobalRole?: string | null;
  onChanged: () => void;
}) {
  const { projectId, members, sessionUserId, sessionGlobalRole, onChanged } = props;
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"members" | "add" | "invite">("members");

  const myProjectRole = useMemo(() => {
    const me = members.find((m) => m.userId === sessionUserId);
    return me?.role || null;
  }, [members, sessionUserId]);

  const canManage = useMemo(
    () => canManageProjectMembers({ globalRole: sessionGlobalRole || "", projectRole: myProjectRole }),
    [sessionGlobalRole, myProjectRole]
  );

  // Add internal user state
  const [userQuery, setUserQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState<"member" | "manager">("member");
  const [savingAdd, setSavingAdd] = useState(false);

  // Invite link state
  const [inviteRole, setInviteRole] = useState<"member" | "manager">("member");
  const [expiresIn, setExpiresIn] = useState<string>("168"); // hours: 7 days
  const [maxUses, setMaxUses] = useState<string>("");
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [inviteLink, setInviteLink] = useState<string>("");

  // Member updates
  const [savingMemberId, setSavingMemberId] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

  const existingIds = useMemo(() => new Set(members.map((m) => m.userId)), [members]);

  // Use React Query hook for fetching users
  const { data: usersData, isLoading: loadingUsers } = useUsersList(open && canManage);
  const users = usersData?.users || [];

  const filteredUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    const available = users.filter((u) => !existingIds.has(u.id));
    if (!q) return available;
    return available.filter((u) => {
      const n = `${u.firstName || ""} ${u.lastName || ""}`.trim().toLowerCase();
      return u.email.toLowerCase().includes(q) || n.includes(q);
    });
  }, [users, existingIds, userQuery]);

  useEffect(() => {
    if (!open) return;
    setInviteLink("");
    setTab("members");
  }, [open]);

  const addUser = async () => {
    if (!selectedUserId) return;
    setSavingAdd(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUserId, role: selectedRole }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Impossibile aggiungere membro");
      toast.success("Membro aggiunto");
      setSelectedUserId("");
      setUserQuery("");
      onChanged();
      setTab("members");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Impossibile aggiungere membro");
    } finally {
      setSavingAdd(false);
    }
  };

  const createInvite = async () => {
    setCreatingInvite(true);
    try {
      const payload: any = {
        projectId,
        role: inviteRole,
      };
      const hours = expiresIn === "never" ? null : Number(expiresIn);
      if (hours && Number.isFinite(hours)) payload.expiresIn = hours;
      const uses = maxUses.trim() ? Number(maxUses.trim()) : null;
      if (uses && Number.isFinite(uses)) payload.maxUses = uses;

      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Impossibile creare invito");
      const token = data?.invite?.token;
      if (!token) throw new Error("Token invito mancante");
      const link = `${window.location.origin}/invites/join?token=${encodeURIComponent(String(token))}`;
      setInviteLink(link);
      toast.success("Link invito creato");
      setTab("invite");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Impossibile creare invito");
    } finally {
      setCreatingInvite(false);
    }
  };

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      toast.success("Link copiato");
    } catch {
      toast.error("Copia non disponibile");
    }
  };

  const updateMemberRole = async (userId: string, role: "member" | "manager" | "owner") => {
    setSavingMemberId(userId);
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Impossibile aggiornare ruolo");
      toast.success("Ruolo aggiornato");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Impossibile aggiornare ruolo");
    } finally {
      setSavingMemberId(null);
    }
  };

  const removeMember = async (userId: string) => {
    setRemovingMemberId(userId);
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Impossibile rimuovere membro");
      toast.success("Membro rimosso");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Impossibile rimuovere membro");
    } finally {
      setRemovingMemberId(null);
    }
  };

  return (
    <>
      {canManage ? (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Membri
        </Button>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <UsersIcon className="h-4 w-4 mr-2" />
          Team
        </Button>
      )}

      <Dialog open={open} onOpenChange={(v) => setOpen(v)}>
        <DialogContent className="sm:max-w-[760px]">
          <DialogHeader>
            <DialogTitle>Team del progetto</DialogTitle>
            <DialogDescription>Gestisci membri, ruoli e inviti.</DialogDescription>
          </DialogHeader>

          <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="members">Membri</TabsTrigger>
              <TabsTrigger value="add" disabled={!canManage}>
                Aggiungi
              </TabsTrigger>
              <TabsTrigger value="invite" disabled={!canManage}>
                Invita
              </TabsTrigger>
            </TabsList>

            <TabsContent value="members" className="mt-4">
              <div className="space-y-3">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-3 border rounded-lg p-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={m.user.image || undefined} />
                        <AvatarFallback className="text-xs">{initials({ ...m.user, email: m.user.email })}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{displayName({ ...m.user, email: m.user.email })}</div>
                        <div className="text-xs text-muted-foreground truncate">{m.user.email}</div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Badge variant="secondary" className="capitalize">
                        {m.role}
                      </Badge>

                      {canManage ? (
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <Select
                            value={m.role}
                            onValueChange={(v) => updateMemberRole(m.userId, v as any)}
                            disabled={savingMemberId === m.userId || removingMemberId === m.userId}
                          >
                            <SelectTrigger className="w-full sm:w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="member">member</SelectItem>
                              <SelectItem value="manager">manager</SelectItem>
                              <SelectItem value="owner">
                                <span className="inline-flex items-center gap-1">
                                  <Shield className="h-3.5 w-3.5" /> owner
                                </span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeMember(m.userId)}
                            disabled={m.role === "owner" || removingMemberId === m.userId}
                            title={m.role === "owner" ? "Owner non rimovibile" : "Rimuovi membro"}
                          >
                            {removingMemberId === m.userId ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="add" className="mt-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Cerca utente</Label>
                  <Input value={userQuery} onChange={(e) => setUserQuery(e.target.value)} placeholder="Nome o email…" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Utente</Label>
                    <Select value={selectedUserId} onValueChange={setSelectedUserId} disabled={loadingUsers || savingAdd}>
                      <SelectTrigger>
                        <SelectValue placeholder={loadingUsers ? "Caricamento..." : "Seleziona"} />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredUsers.slice(0, 50).map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {displayName({ ...u, name: null, email: u.email })} ({u.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {loadingUsers ? (
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <Loader2 className="h-3 w-3 animate-spin" /> Caricamento utenti…
                      </div>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label>Ruolo</Label>
                    <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as any)} disabled={savingAdd}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">member</SelectItem>
                        <SelectItem value="manager">manager</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter className="mt-6">
                <Button variant="outline" onClick={() => setOpen(false)} disabled={savingAdd}>
                  Chiudi
                </Button>
                <Button onClick={addUser} disabled={!selectedUserId || savingAdd}>
                  {savingAdd ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Aggiunta…
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4 mr-2" /> Aggiungi
                    </>
                  )}
                </Button>
              </DialogFooter>
            </TabsContent>

            <TabsContent value="invite" className="mt-4">
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Ruolo invito</Label>
                    <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as any)} disabled={creatingInvite}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">member</SelectItem>
                        <SelectItem value="manager">manager</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Scadenza</Label>
                    <Select value={expiresIn} onValueChange={setExpiresIn} disabled={creatingInvite}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="24">24 ore</SelectItem>
                        <SelectItem value="168">7 giorni</SelectItem>
                        <SelectItem value="720">30 giorni</SelectItem>
                        <SelectItem value="never">Mai</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Max utilizzi (opzionale)</Label>
                    <Input value={maxUses} onChange={(e) => setMaxUses(e.target.value)} placeholder="Es. 1" />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button onClick={createInvite} disabled={creatingInvite}>
                    {creatingInvite ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creazione…
                      </>
                    ) : (
                      <>
                        <Link2 className="h-4 w-4 mr-2" /> Crea link invito
                      </>
                    )}
                  </Button>
                </div>

                {inviteLink ? (
                  <div className="border rounded-lg p-3">
                    <div className="text-sm font-medium mb-2">Link invito</div>
                    <div className="flex items-center gap-2">
                      <Input readOnly value={inviteLink} />
                      <Button variant="outline" size="icon" onClick={copyInvite} title="Copia">
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
              <DialogFooter className="mt-6">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Chiudi
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}

function UsersIcon(props: { className?: string }) {
  return <UserPlus className={props.className} />;
}
