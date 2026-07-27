"use client";

import { useState } from "react";
import { Printer, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clockifyRequest } from "../../clockify-v2-request";
import { ClockifyReportView } from "../../reports/clockify-report-view";

export default function SharedClockifyReport({ token, report: initialReport }: { token: string; report: any }): JSX.Element {
  const [report, setReport] = useState(initialReport);
  const [loading, setLoading] = useState(false);
  async function loadMore(): Promise<void> {
    if (!report.nextCursor) return;
    setLoading(true);
    try {
      const data = await clockifyRequest<any>(`/api/clockify/v2/shared/${encodeURIComponent(token)}?cursor=${encodeURIComponent(report.nextCursor)}&limit=100`);
      const next = data.report;
      setReport((current: any) => ({
        ...next,
        rows: current.type === "detailed" ? [...current.rows, ...next.rows] : current.rows,
        people: current.type === "weekly" ? [...current.people, ...next.people] : current.people,
      }));
    } finally {
      setLoading(false);
    }
  }
  return (
    <main className="min-h-screen bg-secondary/40">
      <article className="report-page mx-auto max-w-[1400px] space-y-5 px-4 py-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary"><ShieldCheck className="h-4 w-4" />Sola lettura</div><h1 className="text-2xl font-bold sm:text-3xl">Report Clockify condiviso</h1><p className="mt-1 text-sm text-muted-foreground">Dati live aggiornati al momento della visualizzazione.</p></div>
          <Button className="report-no-print" variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Stampa</Button>
        </header>
        <ClockifyReportView report={report} loading={loading} onLoadMore={loadMore} />
      </article>
    </main>
  );
}
