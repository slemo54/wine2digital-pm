"use client";

import { useEffect } from "react";
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
import { useNotifications, useMarkAllRead, useMarkOneRead } from "@/hooks/use-notifications";

interface Notification {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  link?: string;
  createdAt: string;
}

// Separate component for each notification to use the hook properly
function NotificationCard({ notification }: { notification: Notification }) {
  const router = useRouter();
  const markOneMutation = useMarkOneRead(notification.id);

  return (
    <Card className={`transition-colors ${notification.isRead ? "opacity-80" : "border-primary/50 bg-primary/5"}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground">{notification.title}</h3>
              {!notification.isRead && (
                <Badge variant="default" className="h-5 px-1.5 text-[10px]">
                  New
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{notification.message}</p>
            <p className="text-xs text-muted-foreground pt-1">
              {format(new Date(notification.createdAt), "PPp", { locale: it })}
            </p>
          </div>
          {notification.link && (
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                try {
                  await markOneMutation.mutateAsync();
                } finally {
                  router.push(notification.link!);
                }
              }}
            >
              Apri
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function NotificationsPage() {
  const { status } = useSession();
  const router = useRouter();
  const { data: notificationsData, isLoading } = useNotifications();
  const notifications = notificationsData?.notifications || [];
  const markAllMutation = useMarkAllRead();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    }
  }, [status, router]);

  const markAllAsRead = async () => {
    markAllMutation.mutate(undefined, {
      onSuccess: () => {
        toast.success("Tutte le notifiche segnate come lette");
      },
      onError: () => {
        toast.error("Errore durante l'aggiornamento");
      },
    });
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-secondary">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const unreadCount = notificationsData?.unreadCount ?? notifications.filter((n) => !n.isRead).length;

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
            <Button onClick={markAllAsRead} disabled={markAllMutation.isPending} variant="outline">
              {markAllMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
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
              <NotificationCard key={n.id} notification={n} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
