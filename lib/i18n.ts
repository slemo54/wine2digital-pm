export type Locale = "en" | "it";

export type I18nKey =
  | "theme.switchToDark"
  | "theme.switchToLight"
  | "kanban.empty.todo.title"
  | "kanban.empty.todo.body"
  | "kanban.empty.in_progress.title"
  | "kanban.empty.in_progress.body"
  | "kanban.empty.done.title"
  | "kanban.empty.done.body"
  | "kanban.empty.cta";

const STRINGS: Record<Locale, Record<I18nKey, string>> = {
  en: {
    "theme.switchToDark": "Switch to dark theme",
    "theme.switchToLight": "Switch to light theme",

    "kanban.empty.todo.title": "No tasks here yet",
    "kanban.empty.todo.body": "Add a task to get started.",
    "kanban.empty.in_progress.title": "Nothing in progress",
    "kanban.empty.in_progress.body": "Move a task here when you start working on it.",
    "kanban.empty.done.title": "No completed tasks yet",
    "kanban.empty.done.body": "Completed tasks will show up here.",
    "kanban.empty.cta": "Add a task",
  },
  it: {
    "theme.switchToDark": "Passa al tema scuro",
    "theme.switchToLight": "Passa al tema chiaro",

    "kanban.empty.todo.title": "Nessuna task per ora",
    "kanban.empty.todo.body": "Aggiungi una task per iniziare.",
    "kanban.empty.in_progress.title": "Nessuna task in corso",
    "kanban.empty.in_progress.body": "Sposta qui una task quando inizi a lavorarci.",
    "kanban.empty.done.title": "Nessuna task completata",
    "kanban.empty.done.body": "Le task completate compariranno qui.",
    "kanban.empty.cta": "Aggiungi una task",
  },
};

export function normalizeLocale(input: unknown): Locale {
  if (input === "it") return "it";
  return "en";
}

export function getClientLocale(): Locale {
  if (typeof document === "undefined") return "en";
  const lang = (document.documentElement.getAttribute("lang") || "").toLowerCase();
  if (lang.startsWith("it")) return "it";
  return "en";
}

export function t(locale: Locale, key: I18nKey): string {
  return STRINGS[locale]?.[key] ?? STRINGS.en[key];
}


