"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";

type User = {
  id: string;
  email: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  department: string | null;
};

type Absence = {
  id: string;
  userId: string;
  type: string;
  startDate: string;
  endDate: string;
  isFullDay: boolean;
  status: string;
  user: User;
};

function getDays(a: Absence) {
  if (a.isFullDay) {
    const s = new Date(a.startDate).getTime();
    const e = new Date(a.endDate).getTime();
    const diff = (e - s) / (1000 * 60 * 60 * 24);
    return Math.max(1, diff + 1);
  }
  return 0; // Se non è full day, per ora ignoriamo il calcolo o contiamo a ore. Qui la richiesta menziona ore/gg. Assumiamo 0.5 per semplicità se partial.
}

export function AbsencesYearlySummary() {
  const [data, setData] = useState<Absence[]>([]);
  const [loading, setLoading] = useState(true);
  const [deptFilter, setDeptFilter] = useState("all");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/absences/summary");
        const d = await res.json();
        setData(d.absences || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const summary = useMemo(() => {
    const map = new Map<string, { user: User; vacation: number; sick: number; personal: number; }>();
    data.forEach(a => {
      const u = a.user;
      if (!u) return;
      if (!map.has(u.id)) {
        map.set(u.id, { user: u, vacation: 0, sick: 0, personal: 0 });
      }
      const st = map.get(u.id)!;
      let days = 0;
      if (a.isFullDay) {
        const s = new Date(a.startDate).getTime();
        const e = new Date(a.endDate).getTime();
        days = Math.max(1, Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1);
      } else {
        days = 0.5; // Aproximation for partial days
      }

      if (a.type === "vacation") st.vacation += days;
      else if (a.type === "sick_leave") st.sick += days;
      else if (a.type === "personal") st.personal += days; // Assuming personal = permessi
    });
    return Array.from(map.values());
  }, [data]);

  const departments = useMemo(() => {
    const set = new Set<string>();
    summary.forEach(s => {
      if (s.user.department) set.add(s.user.department);
    });
    return Array.from(set).sort();
  }, [summary]);

  const filtered = useMemo(() => {
    if (deptFilter === "all") return summary;
    return summary.filter(s => s.user.department === deptFilter);
  }, [summary, deptFilter]);

  const exportCsv = () => {
    const lines = ["Nome,Email,Reparto,Ferie(gg),Permessi(gg/ore),Malattie(gg),Totale"];
    filtered.forEach(s => {
      const u = s.user;
      const name = (u.name || `\${u.firstName || ""} \${u.lastName || ""}`.trim() || u.email).replace(/,/g, " ");
      const dept = (u.department || "-").replace(/,/g, " ");
      const tot = s.vacation + s.personal + s.sick;
      lines.push(`\${name},\${u.email},\${dept},\${s.vacation},\${s.personal},\${s.sick},\${tot}`);
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "riepilogo_ferie_2026.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="py-8 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>;

  return (
    <Card className="mt-8 border-primary/20">
      <CardHeader className="bg-primary/5 pb-4">
        <CardTitle className="text-lg">Riepilogo Anno Corrente (2026)</CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="w-64">
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filtra per reparto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti i reparti</SelectItem>
                {departments.map(d => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Esporta CSV
          </Button>
        </div>

        {filtered.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground border rounded-md">
            Nessun dato disponibile per l&apos;anno 2026.
          </div>
        ) : (
          <div className="border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted text-muted-foreground text-left">
                <tr>
                  <th className="p-3 font-medium">Utente</th>
                  <th className="p-3 font-medium">Reparto</th>
                  <th className="p-3 font-medium text-right">Ferie (gg)</th>
                  <th className="p-3 font-medium text-right">Permessi</th>
                  <th className="p-3 font-medium text-right">Malattie (gg)</th>
                  <th className="p-3 font-medium text-right">Totale</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(s => {
                  const u = s.user;
                  const name = u.name || `\${u.firstName || ""} \${u.lastName || ""}`.trim() || u.email;
                  const tot = s.vacation + s.personal + s.sick;
                  return (
                    <tr key={u.id} className="hover:bg-muted/50">
                      <td className="p-3 font-medium">{name}</td>
                      <td className="p-3 text-muted-foreground">{u.department || "-"}</td>
                      <td className="p-3 text-right">{s.vacation > 0 ? s.vacation : "-"}</td>
                      <td className="p-3 text-right">{s.personal > 0 ? s.personal : "-"}</td>
                      <td className="p-3 text-right">{s.sick > 0 ? s.sick : "-"}</td>
                      <td className="p-3 text-right font-medium">{tot > 0 ? tot : "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
