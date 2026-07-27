import assert from "node:assert/strict";
import { afterEach, before, test } from "node:test";
import React from "react";
import { JSDOM } from "jsdom";

let cleanup: typeof import("@testing-library/react").cleanup;
let render: typeof import("@testing-library/react").render;
let screen: typeof import("@testing-library/react").screen;
let userEvent: typeof import("@testing-library/user-event").default;

before(async () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost" });
  const window = dom.window;
  for (const [name, value] of Object.entries({
    window,
    document: window.document,
    navigator: window.navigator,
    HTMLElement: window.HTMLElement,
    HTMLInputElement: window.HTMLInputElement,
    HTMLTextAreaElement: window.HTMLTextAreaElement,
    SVGElement: window.SVGElement,
    Element: window.Element,
    Node: window.Node,
    NodeFilter: window.NodeFilter,
    Event: window.Event,
    CustomEvent: window.CustomEvent,
    DocumentFragment: window.DocumentFragment,
    MutationObserver: window.MutationObserver,
    getComputedStyle: window.getComputedStyle.bind(window),
    IS_REACT_ACT_ENVIRONMENT: true,
    React,
    requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(callback, 0),
    cancelAnimationFrame: (id: number) => clearTimeout(id),
  })) {
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }
  Object.defineProperty(globalThis, "PointerEvent", { configurable: true, value: window.MouseEvent });
  Object.defineProperty(globalThis, "ResizeObserver", {
    configurable: true,
    value: class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  });
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  });
  Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", { configurable: true, value() {} });
  ({ cleanup, render, screen } = await import("@testing-library/react"));
  userEvent = (await import("@testing-library/user-event")).default;
});

afterEach(() => cleanup());

test("project combobox is keyboard searchable and returns the project id", async () => {
  const { ClockifyV2ProjectCombobox } = await import("./clockify-v2-project-combobox");
  let selected = "";
  render(
    React.createElement(ClockifyV2ProjectCombobox, {
      value: "",
      onChange: (value: string) => { selected = value; },
      projects: [
        { id: "p1", name: "Italian Wine Podcast", client: "wine2digital", clientId: "c1", color: "#F04423", tasks: [] },
        { id: "p2", name: "VIA", client: "Veronafiere", clientId: "c2", color: "#7C3AED", tasks: [] },
      ],
    }),
  );
  const user = userEvent.setup({ document: globalThis.document });
  const trigger = screen.getByRole("combobox", { name: "Seleziona progetto" });
  trigger.focus();
  await user.keyboard("{Enter}");
  const search = screen.getByPlaceholderText("Cerca progetto o cliente…");
  await user.type(search, "VIA");
  const option = screen.getByRole("option", { name: "VIA" });
  await user.click(option);
  assert.equal(selected, "p2");
  assert.equal(trigger.getAttribute("aria-expanded"), "false");
});

test("filter combobox supports a touch selection without exposing ids", async () => {
  const { ClockifyFilterCombobox } = await import("./reports/clockify-filter-combobox");
  let selected = "";
  render(
    React.createElement(ClockifyFilterCombobox, {
      value: "",
      placeholder: "Progetto",
      options: [{ value: "technical-project-id", label: "Italian Wine Academy", description: "wine2digital", color: "#13B8A6" }],
      onChange: (value: string) => { selected = value; },
    }),
  );
  const user = userEvent.setup({ document: globalThis.document });
  const trigger = screen.getByRole("combobox");
  await user.pointer({ keys: "[TouchA]", target: trigger });
  const option = screen.getByRole("option", { name: "Italian Wine Academy wine2digital" });
  await user.pointer({ keys: "[TouchA]", target: option });
  assert.equal(selected, "technical-project-id");
  assert.equal(screen.queryByText("technical-project-id"), null);
});

test("entry dialog exposes save and action controls while preserving the controlled draft", async () => {
  const { ClockifyV2EntryEditor } = await import("./clockify-v2-entry-editor");
  let saves = 0;
  const form = {
    projectId: "p1",
    taskId: "",
    description: "Mappa interattiva",
    tags: "",
    billable: false,
    date: "2026-07-22",
    startTime: "09:00",
    endAt: "11:00",
    durationMin: "120",
    mode: "end" as const,
  };
  render(
    React.createElement(ClockifyV2EntryEditor, {
      open: true,
      mode: "create",
      form,
      entry: null,
      projects: [{ id: "p1", name: "Italian Wine Podcast", client: "wine2digital", clientId: "c1", color: "#F04423", tasks: [] }],
      tagSuggestions: [],
      warnings: [],
      saving: false,
      isAdmin: false,
      onOpenChange: () => undefined,
      onChange: () => undefined,
      onSave: async () => { saves += 1; },
      onDuplicate: () => undefined,
      onSplit: () => undefined,
      onDelete: async () => undefined,
      onLockChange: async () => undefined,
    }),
  );
  const user = userEvent.setup({ document: globalThis.document });
  assert.equal(screen.getByRole("textbox", { name: "Descrizione" }).getAttribute("value"), null);
  assert.equal((screen.getByRole("textbox", { name: "Descrizione" }) as HTMLTextAreaElement).value, "Mappa interattiva");
  await user.click(screen.getByRole("button", { name: "Salva" }));
  assert.equal(saves, 1);
  assert.equal(screen.getByRole("dialog", { name: "Nuova attività" }).getAttribute("data-state"), "open");
});

test("confirming entry deletion releases the modal layer before the editor closes", async () => {
  const { ClockifyV2EntryEditor } = await import("./clockify-v2-entry-editor");
  let backgroundClicks = 0;
  const entry: any = {
    id: "e1",
    userId: "u1",
    projectId: "p1",
    taskId: null,
    description: "Mappa interattiva",
    tags: [],
    billable: false,
    workDate: "2026-07-21T22:00:00.000Z",
    startAt: "2026-07-22T07:00:00.000Z",
    endAt: "2026-07-22T09:00:00.000Z",
    durationMin: 120,
    effectiveLocked: false,
    project: { id: "p1", name: "Italian Wine Podcast", client: "wine2digital", color: "#F04423" },
    user: { id: "u1", name: "Anselmo", email: "a@example.test", department: "Grafica" },
  };
  const form = {
    projectId: "p1",
    taskId: "",
    description: entry.description,
    tags: "",
    billable: false,
    date: "2026-07-22",
    startTime: "09:00",
    endAt: "11:00",
    durationMin: "120",
    mode: "end" as const,
  };
  function Harness(): JSX.Element {
    const [open, setOpen] = React.useState(true);
    return React.createElement(
      React.Fragment,
      null,
      React.createElement("button", { onClick: () => { backgroundClicks += 1; } }, "Azione pagina"),
      React.createElement("button", { onClick: () => setOpen(true) }, "Riapri editor"),
      React.createElement(ClockifyV2EntryEditor, {
        open,
        mode: "edit",
        form,
        entry,
        projects: [{ id: "p1", name: "Italian Wine Podcast", client: "wine2digital", clientId: "c1", color: "#F04423", tasks: [] }],
        tagSuggestions: [],
        warnings: [],
        saving: false,
        isAdmin: false,
        onOpenChange: setOpen,
        onChange: () => undefined,
        onSave: async () => undefined,
        onDuplicate: () => undefined,
        onSplit: () => undefined,
        onDelete: async () => { setOpen(false); },
        onLockChange: async () => undefined,
      }),
    );
  }
  render(React.createElement(Harness));
  const user = userEvent.setup({ document: globalThis.document });
  await user.click(screen.getByRole("button", { name: "Azioni attività" }));
  await user.click(screen.getByRole("menuitem", { name: "Elimina" }));
  assert.equal(screen.getByRole("alertdialog", { name: "Eliminare questa attività?" }).getAttribute("data-state"), "open");
  assert.equal(globalThis.document.activeElement?.textContent, "Annulla");
  await user.keyboard("{Escape}");
  assert.equal(screen.getByRole("dialog", { name: "Modifica attività" }).getAttribute("data-state"), "open");
  await user.click(screen.getByRole("button", { name: "Azioni attività" }));
  await user.click(screen.getByRole("menuitem", { name: "Elimina" }));
  await user.click(screen.getByRole("button", { name: "Elimina" }));
  await new Promise((resolve) => setTimeout(resolve, 250));
  assert.notEqual(globalThis.document.body.style.pointerEvents, "none");
  await user.click(screen.getByRole("button", { name: "Azione pagina" }));
  assert.equal(backgroundClicks, 1);
  await user.click(screen.getByRole("button", { name: "Riapri editor" }));
  assert.equal(screen.getByRole("dialog", { name: "Modifica attività" }).getAttribute("data-state"), "open");
});
