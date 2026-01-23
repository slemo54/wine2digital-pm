"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, LogOut, User } from "lucide-react";
import { signOut } from "next-auth/react";

export default function ProfilePage() {
  const { data: session, status } = useSession() || {};
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-secondary">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const user = session?.user as any;
  const displayName =
    (user?.name as string | undefined) ||
    `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
    "Utente";
  const email = (user?.email as string | undefined) || "";
  const role = (user?.role as string | undefined) || "member";
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p: string) => p[0])
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen min-h-[100dvh] bg-secondary">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Dashboard
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="min-w-0">
                <CardTitle className="text-2xl">Profilo</CardTitle>
                <div className="text-sm text-muted-foreground">Dati dell’account e accesso.</div>
              </div>
              <Badge variant="secondary" className="capitalize self-start sm:self-auto shrink-0">
                {role}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14">
                <AvatarImage src={user?.image || undefined} />
                <AvatarFallback className="bg-primary text-white">{initials || "U"}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="text-lg font-semibold truncate">{displayName}</div>
                <div className="text-sm text-muted-foreground truncate">{email}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-secondary/30">
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">Email</div>
                  <div className="font-medium break-all">{email || "—"}</div>
                </CardContent>
              </Card>
              <Card className="bg-secondary/30">
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">Ruolo</div>
                  <div className="font-medium capitalize">{role}</div>
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <Link href="/dashboard" className="w-full sm:w-auto">
                <Button variant="outline" className="w-full sm:w-auto">
                  <User className="h-4 w-4 mr-2" />
                  Torna alla Dashboard
                </Button>
              </Link>
              <Button
                onClick={() => signOut({ callbackUrl: "/auth/login" })}
                className="bg-black text-white hover:bg-black/90 w-full sm:w-auto"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Esci
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

