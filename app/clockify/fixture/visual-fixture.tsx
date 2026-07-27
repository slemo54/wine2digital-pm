"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChartNoAxesColumn, List, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { ClockifyV2Calendar, type ClockifyCalendarView } from "../clockify-v2-calendar";
import { ClockifyV2EntryEditor } from "../clockify-v2-entry-editor";
import { ClockifyV2EntryForm } from "../clockify-v2-entry-form";
import { ClockifyV2EntryList } from "../clockify-v2-entry-list";
import type { ClockifyV2Entry, ClockifyV2Form, ClockifyV2Project } from "../clockify-v2-types";
import { ClockifyReportView } from "../reports/clockify-report-view";

type Screen = "timesheet" | "calendar" | "summary" | "detailed";

const PROJECTS: ClockifyV2Project[] = [
  { id: "podcast", name: "Italian Wine Podcast", client: "wine2digital", clientId: "w2d", color: "#F04423", isActive: true, tasks: [{ id: "editorial", name: "Editoriale", isActive: true }] },
  { id: "academy", name: "Italian Wine Academy", client: "wine2digital", clientId: "w2d", color: "#13B8A6", isActive: true, tasks: [{ id: "website", name: "Sito web", isActive: true }] },
  { id: "housekeeping", name: "Housekeeping / Common interest", client: "wine2digital", clientId: "w2d", color: "#8BC34A", isActive: true, tasks: [{ id: "research", name: "Ricerca", isActive: true }] },
  { id: "via", name: "VIA", client: "Veronafiere", clientId: "vf", color: "#7C3AED", isActive: true, tasks: [{ id: "report", name: "Report", isActive: true }] },
];

function entry(
  id: string,
  projectId: string,
  description: string,
  startAt: string,
  endAt: string,
  extras: Partial<ClockifyV2Entry> = {},
): ClockifyV2Entry {
  const project = PROJECTS.find((item) => item.id === projectId)!;
  const durationMin = Math.round((new Date(endAt).getTime() - new Date(startAt).getTime()) / 60_000);
  return {
    id,
    userId: "fixture-user",
    projectId,
    taskId: project.tasks[0]?.id || null,
    description,
    task: project.tasks[0]?.name || null,
    tags: [],
    billable: false,
    workDate: startAt.slice(0, 10),
    startAt,
    endAt,
    durationMin,
    lockedAt: null,
    lockKind: null,
    effectiveLocked: false,
    effectiveLockKind: null,
    user: { id: "fixture-user", name: "Anselmo", email: "anselmo@example.test", department: "Marketing" },
    project: { id: project.id, name: project.name, client: project.client, color: project.color, isActive: true },
    clockifyTask: project.tasks[0] || null,
    ...extras,
  };
}

const ENTRIES: ClockifyV2Entry[] = [
  entry("e8", "academy", "Modifiche aggiornamenti sito controllo voucher", "2026-07-22T07:00:00.000Z", "2026-07-22T09:00:00.000Z", { tags: ["website"], billable: true }),
  entry("e7", "podcast", "Mappa interattiva", "2026-07-22T09:00:00.000Z", "2026-07-22T11:00:00.000Z"),
  entry("e6", "housekeeping", "Ricerca e sviluppo AI", "2026-07-22T12:45:00.000Z", "2026-07-22T14:45:00.000Z", { tags: ["ricerca"] }),
  entry("e5", "podcast", "Check siti e aggiornamento sicurezza", "2026-07-22T14:45:00.000Z", "2026-07-22T16:45:00.000Z", { effectiveLocked: true, lockedAt: "2026-07-22T17:00:00.000Z", lockKind: "manual", effectiveLockKind: "manual" }),
  entry("e4", "academy", "Modifiche aggiornamenti sito controllo voucher", "2026-07-21T06:45:00.000Z", "2026-07-21T08:45:00.000Z", { billable: true }),
  entry("e3", "podcast", "Mappa interattiva", "2026-07-21T09:00:00.000Z", "2026-07-21T11:00:00.000Z"),
  entry("e2", "housekeeping", "Ricerca e sviluppo AI", "2026-07-21T12:30:00.000Z", "2026-07-21T14:30:00.000Z", { tags: ["AI"] }),
  entry("e1", "podcast", "Check siti e aggiornamento sicurezza siti", "2026-07-21T15:30:00.000Z", "2026-07-21T17:30:00.000Z"),
];

const EMPTY_FORM: ClockifyV2Form = {
  projectId: "podcast",
  taskId: "",
  description: "",
  tags: "",
  billable: false,
  date: "2026-07-22",
  startTime: "09:00",
  endAt: "11:00",
  durationMin: "120",
  mode: "end",
};

const SUMMARY_REPORT = {
  type: "summary",
  totalMin: 16 * 60,
  billableMin: 4 * 60,
  entryCount: ENTRIES.length,
  timeSeries: [
    { date: "2026-07-20", totalMin: 8 * 60 },
    { date: "2026-07-21", totalMin: 8 * 60 },
    { date: "2026-07-22", totalMin: 8 * 60 },
  ],
  bar: [
    { label: "Italian Wine Podcast", totalMin: 8 * 60 },
    { label: "Housekeeping / Common interest", totalMin: 4 * 60 },
    { label: "Italian Wine Academy", totalMin: 4 * 60 },
  ],
};

const DETAILED_REPORT = {
  type: "detailed",
  total: { count: ENTRIES.length, totalMin: ENTRIES.reduce((sum, item) => sum + item.durationMin, 0) },
  rows: ENTRIES.map((item) => ({
    ...item,
    projectName: item.project?.name,
    client: item.project?.client,
    userName: item.user?.name,
    userEmail: item.user?.email,
    department: item.user?.department,
  })),
};

export default function ClockifyVisualFixture(): JSX.Element {
  const { setTheme } = useTheme();
  const [screen, setScreen] = useState<Screen>("timesheet");
  const [dark, setDark] = useState(true);
  const [form, setForm] = useState<ClockifyV2Form>(EMPTY_FORM);
  const [editorOpen, setEditorOpen] = useState(false);
  const [selected, setSelected] = useState<ClockifyV2Entry | null>(null);
  const [calendarView, setCalendarView] = useState<ClockifyCalendarView>("week");
  const [anchor, setAnchor] = useState(new Date("2026-07-22T10:00:00.000Z"));

  useEffect(() => {
    setTheme(dark ? "dark" : "light");
  }, [dark, setTheme]);

  const days = useMemo(() => ["2026-07-22", "2026-07-21"].map((date) => {
    const entries = ENTRIES.filter((item) => item.workDate === date);
    return {
      date,
      entries,
      totalMin: entries.reduce((sum, item) => sum + item.durationMin, 0),
      billableMin: entries.filter((item) => item.billable).reduce((sum, item) => sum + item.durationMin, 0),
    };
  }), []);
  const totalMin = ENTRIES.reduce((sum, item) => sum + item.durationMin, 0);

  const openEntry = (item: ClockifyV2Entry) => {
    setSelected(item);
    setForm({
      projectId: item.projectId,
      taskId: item.taskId || "",
      description: item.description,
      tags: item.tags.join(", "),
      billable: item.billable,
      date: item.workDate,
      startTime: new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(item.startAt)),
      endAt: new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(item.endAt)),
      durationMin: String(item.durationMin),
      mode: "end",
    });
    setEditorOpen(true);
  };

  return (
    <main className="clockify-visual-fixture min-h-screen bg-secondary text-foreground">
      <style jsx global>{`
        body:has(.clockify-visual-fixture) .elfsight-app-57b93af2-30e0-4b47-ab37-53e380b55c5a,
        body:has(.clockify-visual-fixture) .tsqd-parent-container,
        body:has(.clockify-visual-fixture) #__EAAPS_PORTAL {
          display: none !important;
        }
      `}</style>
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h1 className="text-xl font-bold">Clockify</h1>
            <p className="text-xs text-muted-foreground">Fixture visuale deterministica · Europe/Rome</p>
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <nav className="flex min-w-0 flex-1 overflow-x-auto rounded-lg border bg-muted/25 p-1 sm:flex-none" aria-label="Schermata fixture">
              {([
                ["timesheet", "Timesheet", List],
                ["calendar", "Calendario", CalendarDays],
                ["summary", "Summary", ChartNoAxesColumn],
                ["detailed", "Detailed", ChartNoAxesColumn],
              ] as const).map(([value, label, Icon]) => (
                <Button key={value} size="sm" variant={screen === value ? "secondary" : "ghost"} onClick={() => setScreen(value)}>
                  <Icon className="mr-1.5 h-4 w-4" />{label}
                </Button>
              ))}
            </nav>
            <Button type="button" size="icon" variant="outline" onClick={() => setDark((value) => !value)} aria-label={dark ? "Usa tema chiaro" : "Usa tema scuro"}>
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] space-y-5 px-4 py-5 sm:px-6">
        {screen === "timesheet" && (
          <>
            <ClockifyV2EntryForm
              form={form}
              projects={PROJECTS}
              saving={false}
              onChange={setForm}
              onSubmit={async () => setForm(EMPTY_FORM)}
              onOpenEditor={() => {
                setSelected(null);
                setEditorOpen(true);
              }}
            />
            <ClockifyV2EntryList
              days={days}
              weeks={[{ startDate: "2026-07-20", totalMin, billableMin: 240 }]}
              period={{ totalMin, billableMin: 240 }}
              onView={openEntry}
            />
          </>
        )}
        {screen === "calendar" && (
          <ClockifyV2Calendar
            entries={ENTRIES}
            onView={openEntry}
            view={calendarView}
            anchor={anchor}
            onViewChange={setCalendarView}
            onAnchorChange={setAnchor}
          />
        )}
        {screen === "summary" && <ClockifyReportView report={SUMMARY_REPORT} />}
        {screen === "detailed" && <ClockifyReportView report={DETAILED_REPORT} />}
      </div>

      <ClockifyV2EntryEditor
        open={editorOpen}
        mode={selected?.effectiveLocked ? "readonly" : selected ? "edit" : "create"}
        form={form}
        entry={selected}
        projects={PROJECTS}
        tagSuggestions={["AI", "ricerca", "website"]}
        warnings={[]}
        saving={false}
        isAdmin
        onOpenChange={setEditorOpen}
        onChange={setForm}
        onSave={async () => setEditorOpen(false)}
        onDuplicate={() => undefined}
        onSplit={() => undefined}
        onDelete={async () => setEditorOpen(false)}
        onLockChange={async () => undefined}
      />
    </main>
  );
}
