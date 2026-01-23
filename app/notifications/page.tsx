"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Bell, Check } from "lucide-react";
import { toast } from "react-hot-toast";
import Link from "next/link";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { markAllRead, markNotificationRead } from "@/lib/notifications-client";

interface Notification {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  link?: string;
  createdAt: string;
}

export default function NotificationsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingRead, setMarkingRead] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    }
  }, [status, router]);

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) throw new Error("Errore caricamento");
      const data = await res.json();
      setNotifications(data.notifications || []);
    } catch (e) {
      toast.error("Impossibile caricare le notifiche");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated") {
      fetchNotifications();
    }
  }, [status]);

  const markAllAsRead = async () => {
    setMarkingRead(true);
    try {
      const r = await markAllRead();
      if (!r.ok) throw new Error("Errore");
      await fetchNotifications();
      toast.success("Tutte le notifiche segnate come lette");
    } catch {
      toast.error("Errore durante l'aggiornamento");
    } finally {
      setMarkingRead(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-secondary">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="min-h-screen min-h-[100dvh] bg-secondary">
      <div className="max-w-[800px] mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Bell className="h-8 w-8" /> Notifiche
            </h1>
            <p className="text-muted-foreground mt-1">
              Rimani aggiornato sulle attività dei tuoi progetti.
            </p>
          </div>
          {unreadCount > 0 && (
            <Button onClick={markAllAsRead} disabled={markingRead} variant="outline">
              {markingRead ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
              Segna tutte come lette
            </Button>
          )}
        </div>

        <div className="space-y-4">
          {notifications.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Non hai notifiche al momento.
              </CardContent>
            </Card>
          ) : (
            notifications.map((n) => (
              <Card key={n.id} className={`transition-colors ${n.isRead ? "opacity-80" : "border-primary/50 bg-primary/5"}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground">{n.title}</h3>
                        {!n.isRead && (
                          <Badge variant="default" className="h-5 px-1.5 text-[10px]">
                            New
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{n.message}</p>
                      <p className="text-xs text-muted-foreground pt-1">
                        {format(new Date(n.createdAt), "PPp", { locale: it })}
                      </p>
                    </div>
                    {n.link && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          try {
                            await markNotificationRead(n.id);
                          } finally {
                            router.push(n.link!);
                          }
                        }}
                      >
                        Apri
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
