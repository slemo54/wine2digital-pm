"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ClockifyAnnouncement() {
  const { status } = useSession();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;

    let active = true;
    void fetch("/api/announcements/clockify", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (active && data?.show === true) setOpen(true);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [status]);

  const dismiss = useCallback(async () => {
    setOpen(false);
    setSaving(true);
    try {
      await fetch("/api/announcements/clockify", { method: "POST" });
    } finally {
      setSaving(false);
    }
  }, []);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? setOpen(true) : void dismiss())}>
      <DialogContent>
        <DialogHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Timer className="h-5 w-5" />
          </div>
          <DialogTitle>È disponibile il nuovo modulo Clockify</DialogTitle>
          <DialogDescription>
            Registra le attività giornaliere, consulta le ore lavorate e organizza il tempo per progetto direttamente da Wine2Digital PM.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => void dismiss()} disabled={saving}>
            Ho capito
          </Button>
          <Button asChild onClick={() => void dismiss()}>
            <Link href="/clockify">Apri Clockify</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
