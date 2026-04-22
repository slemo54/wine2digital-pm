"use client";

import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, LogOut, User, Camera, Save, KeyRound } from "lucide-react";
import { signOut } from "next-auth/react";
import { toast } from "react-hot-toast";

export default function ProfilePage() {
  const { data: session, status, update } = useSession() || {};
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [language, setLanguage] = useState("it");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    } else if (status === "authenticated" && session?.user) {
      const u = session.user as any;
      setDisplayName(u.name || `${u.firstName || ""} ${u.lastName || ""}`.trim() || "");
      setLanguage(u.language || "it");
      setAvatarPreview(u.image || null);
    }
  }, [status, session, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-secondary">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const user = session?.user as any;
  const email = (user?.email as string | undefined) || "";
  const role = (user?.role as string | undefined) || "member";
  const createdAt = user?.createdAt ? new Date(user.createdAt).toLocaleDateString("it-IT") : "N/D";

  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p: string) => p[0])
    .join("")
    .toUpperCase();

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 200 * 1024) {
      toast.error("L'immagine non può superare i 200KB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setAvatarPreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: displayName,
          language,
          image: avatarPreview
        }),
      });

      if (!res.ok) throw new Error("Errore durante il salvataggio");

      await update({
        ...session,
        user: {
          ...session?.user,
          name: displayName,
          language,
          image: avatarPreview
        }
      });

      toast.success("Profilo aggiornato con successo");
    } catch (error) {
      toast.error("Impossibile salvare il profilo");
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("Le nuove password non corrispondono");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("La nuova password deve contenere almeno 8 caratteri");
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Errore durante il cambio password");

      toast.success("Password aggiornata con successo");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast.error(error.message || "Impossibile aggiornare la password");
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] bg-secondary">
      <div className="max-w-[1000px] mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Dashboard
            </Button>
          </Link>
          <Button
            onClick={() => signOut({ callbackUrl: "/auth/login" })}
            variant="destructive"
            size="sm"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Esci
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 space-y-6">
            <Card>
              <CardContent className="pt-6 flex flex-col items-center text-center space-y-4">
                <div className="relative group">
                  <Avatar className="h-24 w-24 border-4 border-background shadow-sm">
                    <AvatarImage src={avatarPreview || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xl font-medium">{initials || "U"}</AvatarFallback>
                  </Avatar>
                  <div
                    className="absolute inset-0 bg-black/40 text-white rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Camera className="h-6 w-6" />
                    <span className="text-[10px] font-medium mt-1">Cambia foto</span>
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/png, image/jpeg, image/jpg"
                    onChange={handleAvatarChange}
                  />
                </div>
                <div>
                  <h2 className="text-xl font-bold truncate px-2">{displayName || "Utente"}</h2>
                  <p className="text-sm text-muted-foreground">{email}</p>
                </div>
                <Badge variant="secondary" className="capitalize">
                  {role}
                </Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Info Account</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">Data Registrazione</span>
                  <span className="font-medium">{createdAt}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">Ruolo</span>
                  <span className="font-medium capitalize">{role}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-muted-foreground">Stato</span>
                  <Badge variant="outline" className="bg-success/10 text-success border-success/20">Attivo</Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="md:col-span-2">
            <Tabs defaultValue="general" className="w-full">
              <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent mb-6">
                <TabsTrigger value="general" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent pb-3 pt-2 px-4">
                  Generale
                </TabsTrigger>
                <TabsTrigger value="security" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent pb-3 pt-2 px-4">
                  Sicurezza
                </TabsTrigger>
              </TabsList>

              <TabsContent value="general" className="space-y-6 mt-0">
                <Card>
                  <CardHeader>
                    <CardTitle>Informazioni Profilo</CardTitle>
                    <CardDescription>Aggiorna le tue informazioni personali.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="displayName">Nome Visualizzato</Label>
                      <Input
                        id="displayName"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Es. Mario Rossi"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Indirizzo Email</Label>
                      <Input
                        id="email"
                        value={email}
                        disabled
                        className="bg-secondary/50 text-muted-foreground"
                      />
                      <p className="text-xs text-muted-foreground mt-1">L&apos;indirizzo email non può essere modificato.</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="language">Preferenza Lingua</Label>
                      <Select value={language} onValueChange={setLanguage}>
                        <SelectTrigger id="language">
                          <SelectValue placeholder="Seleziona lingua" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="it">Italiano</SelectItem>
                          <SelectItem value="en">English</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">Predisposizione per supporto multilingua futuro.</p>
                    </div>

                    <Button onClick={handleSaveProfile} disabled={loading} className="w-full sm:w-auto">
                      {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                      Salva Modifiche
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="security" className="space-y-6 mt-0">
                <Card>
                  <CardHeader>
                    <CardTitle>Cambio Password</CardTitle>
                    <CardDescription>Assicurati di usare una password forte di almeno 8 caratteri.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleChangePassword} className="space-y-6">
                      <div className="space-y-2">
                        <Label htmlFor="currentPassword">Password Attuale</Label>
                        <Input
                          id="currentPassword"
                          type="password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="newPassword">Nuova Password</Label>
                        <Input
                          id="newPassword"
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          required
                          minLength={8}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirmPassword">Conferma Nuova Password</Label>
                        <Input
                          id="confirmPassword"
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                          minLength={8}
                        />
                      </div>
                      <Button type="submit" disabled={passwordLoading} className="w-full sm:w-auto">
                        {passwordLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <KeyRound className="h-4 w-4 mr-2" />}
                        Aggiorna Password
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
