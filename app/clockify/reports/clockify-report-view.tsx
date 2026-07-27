"use client";

import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CircleDollarSign, Clock3, FileClock, Lock, LockOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { clockifyRomeTime, formatClockifyDay, formatClockifyDuration } from "../clockify-v2-format";

const COLORS = ["#8BC34A", "#14B8A6", "#F59E0B", "#A855F7", "#EC4899", "#3B82F6", "#F97316", "#64748B"];

export function ClockifyReportView({ report, loading = false, onLoadMore }: { report: any; loading?: boolean; onLoadMore?: () => Promise<void> }): JSX.Element {
  if (!report) return <ReportLoading />;
  if (report.type === "summary") return <SummaryReport report={report} />;
  if (report.type === "detailed") return <DetailedReport report={report} loading={loading} onLoadMore={onLoadMore} />;
  return <WeeklyReport report={report} loading={loading} onLoadMore={onLoadMore} />;
}

function SummaryReport({ report }: { report: any }): JSX.Element {
  const distribution = report.distribution || report.bar || [];
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric icon={<Clock3 />} label="Ore totali" value={formatClockifyDuration(report.totalMin || 0)} />
        <Metric icon={<CircleDollarSign />} label="Fatturabile" value={formatClockifyDuration(report.billableMin || 0)} />
        <Metric icon={<FileClock />} label="Registrazioni" value={String(report.entryCount || 0)} />
      </div>
      <Card>
        <CardHeader className="border-b"><CardTitle>Andamento temporale</CardTitle></CardHeader>
        <CardContent className="h-[360px] pt-6" aria-label="Grafico a barre dell’andamento temporale">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={report.timeSeries || []} margin={{ top: 12, right: 12, left: 4, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tickFormatter={(value) => String(value).slice(5)} minTickGap={22} />
              <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 60)}h`} width={42} />
              <Tooltip formatter={(value) => formatClockifyDuration(Number(value))} labelFormatter={(value) => formatClockifyDay(String(value), "short")} />
              <Bar dataKey="totalMin" name="Durata" fill="#8BC34A" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader className="border-b"><CardTitle>Ripartizione</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {(report.bar || []).map((row: any, index: number) => (
                <div key={row.label} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-5 py-3">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="truncate font-medium">{row.label}</span>
                  <span className="font-semibold tabular-nums">{formatClockifyDuration(row.totalMin)}</span>
                </div>
              ))}
              {(report.bar || []).length === 0 && <p className="px-5 py-8 text-sm text-muted-foreground">Scegli un raggruppamento per vedere la ripartizione.</p>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="border-b"><CardTitle>Distribuzione</CardTitle></CardHeader>
          <CardContent className="h-[320px] pt-5" aria-label="Grafico a ciambella della distribuzione">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={distribution} dataKey="totalMin" nameKey="label" innerRadius="52%" outerRadius="78%" paddingAngle={1}>
                  {distribution.map((_: any, index: number) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(value) => formatClockifyDuration(Number(value))} />
                <Legend verticalAlign="bottom" height={44} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }): JSX.Element {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary [&_svg]:h-5 [&_svg]:w-5">{icon}</span>
        <div><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-bold tabular-nums">{value}</p></div>
      </CardContent>
    </Card>
  );
}

function DetailedReport({ report, loading, onLoadMore }: { report: any; loading: boolean; onLoadMore?: () => Promise<void> }): JSX.Element {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between border-b">
        <div><CardTitle>Dettaglio registrazioni</CardTitle><p className="mt-1 text-sm text-muted-foreground">{report.total?.count || 0} attività</p></div>
        <span className="text-xl font-bold tabular-nums">{formatClockifyDuration(report.total?.totalMin || 0)}</span>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table className="min-w-[980px]">
            <TableHeader><TableRow><TableHead>Attività</TableHead><TableHead>Utente</TableHead><TableHead>Data e ora</TableHead><TableHead>Tag</TableHead><TableHead>Stato</TableHead><TableHead className="text-right">Durata</TableHead></TableRow></TableHeader>
            <TableBody>
              {(report.rows || []).map((row: any) => (
                <TableRow key={row.id}>
                  <TableCell className="max-w-[360px] py-4">
                    <p className="truncate font-medium">{row.description}</p>
                    <p className="mt-1 truncate text-sm text-muted-foreground"><span className="font-medium text-foreground">{row.projectName}</span> · {row.client || "Senza cliente"}{row.task ? ` · ${row.task}` : ""}</p>
                  </TableCell>
                  <TableCell className="py-4"><p className="font-medium">{row.userName || row.userEmail}</p><p className="text-xs text-muted-foreground">{row.department || "—"}</p></TableCell>
                  <TableCell className="py-4"><p className="capitalize">{formatClockifyDay(String(row.workDate).slice(0, 10), "short")}</p><p className="text-xs tabular-nums text-muted-foreground">{clockifyRomeTime(row.startAt)} – {clockifyRomeTime(row.endAt)}</p></TableCell>
                  <TableCell className="py-4"><div className="flex max-w-[180px] flex-wrap gap-1">{(row.tags || []).map((tag: string) => <Badge variant="secondary" key={tag}>{tag}</Badge>)}</div></TableCell>
                  <TableCell className="py-4">{row.effectiveLocked ? <Badge variant="warning" className="gap-1"><Lock className="h-3 w-3" />Bloccata</Badge> : <Badge variant="outline" className="gap-1"><LockOpen className="h-3 w-3" />Aperta</Badge>}</TableCell>
                  <TableCell className="py-4 text-right text-base font-bold tabular-nums">{formatClockifyDuration(row.durationMin)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {(report.rows || []).length === 0 && <p className="px-6 py-12 text-center text-sm text-muted-foreground">Nessuna registrazione corrisponde ai filtri applicati.</p>}
        {report.nextCursor && onLoadMore && <div className="border-t p-4 text-center"><Button variant="outline" disabled={loading} onClick={() => void onLoadMore()}>{loading ? "Caricamento…" : "Carica altre registrazioni"}</Button></div>}
      </CardContent>
    </Card>
  );
}

function WeeklyReport({ report, loading, onLoadMore }: { report: any; loading: boolean; onLoadMore?: () => Promise<void> }): JSX.Element {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between border-b"><CardTitle>Matrice settimanale</CardTitle><span className="text-xl font-bold tabular-nums">{formatClockifyDuration(report.grandTotalMin || 0)}</span></CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table className="min-w-[900px]">
            <TableHeader><TableRow><TableHead>Persona</TableHead>{(report.days || []).map((day: string) => <TableHead className="text-right capitalize" key={day}>{formatClockifyDay(day, "short")}</TableHead>)}<TableHead className="text-right">Totale</TableHead></TableRow></TableHeader>
            <TableBody>
              {(report.people || []).map((person: any) => <TableRow key={person.userId}><TableCell className="py-4 font-medium">{person.name}</TableCell>{person.days.map((day: any) => <TableCell className="py-4 text-right tabular-nums" key={day.date}>{formatClockifyDuration(day.totalMin)}</TableCell>)}<TableCell className="py-4 text-right font-bold tabular-nums">{formatClockifyDuration(person.totalMin)}</TableCell></TableRow>)}
              <TableRow className="bg-muted/35 font-semibold"><TableCell className="py-4">Totale</TableCell>{(report.dayTotals || []).map((day: any) => <TableCell className="py-4 text-right tabular-nums" key={day.date}>{formatClockifyDuration(day.totalMin)}</TableCell>)}<TableCell className="py-4 text-right tabular-nums">{formatClockifyDuration(report.grandTotalMin || 0)}</TableCell></TableRow>
            </TableBody>
          </Table>
        </div>
        {report.nextCursor && onLoadMore && <div className="border-t p-4 text-center"><Button variant="outline" disabled={loading} onClick={() => void onLoadMore()}>{loading ? "Caricamento…" : "Carica altre persone"}</Button></div>}
      </CardContent>
    </Card>
  );
}

function ReportLoading(): JSX.Element {
  return <div className="rounded-xl border bg-card px-6 py-14 text-center text-sm text-muted-foreground">Caricamento report…</div>;
}
