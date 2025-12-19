"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Mention from "@tiptap/extension-mention";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Image as ImageIcon } from "lucide-react";

export type MentionUser = {
  id: string;
  label: string;
  email?: string | null;
  image?: string | null;
};

function collectMentionedUserIds(doc: any): string[] {
  const ids = new Set<string>();
  const walk = (node: any) => {
    if (!node || typeof node !== "object") return;
    if (node.type === "mention") {
      const id = node.attrs?.id;
      if (typeof id === "string" && id.trim()) ids.add(id.trim());
    }
    const content = node.content;
    if (Array.isArray(content)) content.forEach(walk);
  };
  walk(doc);
  return Array.from(ids);
}

function buildMentionSuggestion(users: MentionUser[]) {
  return {
    items: ({ query }: { query: string }) => {
      const q = (query || "").toLowerCase().trim();
      if (!q) return users.slice(0, 8);
      return users
        .filter((u) => {
          const hay = `${u.label} ${u.email || ""}`.toLowerCase();
          return hay.includes(q);
        })
        .slice(0, 8);
    },
    render: () => {
      let root: Root | null = null;
      let container: HTMLDivElement | null = null;
      let selectedIndex = 0;
      let currentItems: MentionUser[] = [];
      let currentCommand: ((opts: { id: string; label: string }) => void) | null = null;

      const position = (clientRect?: DOMRect | null) => {
        if (!container || !clientRect) return;
        container.style.left = `${clientRect.left}px`;
        container.style.top = `${clientRect.bottom + 6}px`;
      };

      const renderList = () => {
        if (!root || !container) return;
        root.render(
          <div className="min-w-[240px] max-w-[320px] overflow-hidden rounded-md border bg-popover shadow-md">
            <div className="p-1">
              {currentItems.length === 0 ? (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">Nessun risultato</div>
              ) : (
                currentItems.map((u, idx) => (
                  <button
                    key={u.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      currentCommand?.({ id: u.id, label: u.label });
                    }}
                    className={cn(
                      "w-full text-left px-2 py-1.5 rounded-sm text-sm flex items-center justify-between gap-2",
                      idx === selectedIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                    )}
                  >
                    <span className="truncate">@{u.label}</span>
                    {u.email ? <span className="truncate text-xs text-muted-foreground">{u.email}</span> : null}
                  </button>
                ))
              )}
            </div>
          </div>
        );
      };

      return {
        onStart: (props: any) => {
          container = document.createElement("div");
          container.className = "fixed z-[90]";
          document.body.appendChild(container);
          root = createRoot(container);
          selectedIndex = 0;
          currentItems = props.items || [];
          currentCommand = props.command || null;
          position(props.clientRect?.());
          renderList();
        },
        onUpdate: (props: any) => {
          currentItems = props.items || [];
          currentCommand = props.command || null;
          selectedIndex = 0;
          position(props.clientRect?.());
          renderList();
        },
        onKeyDown: (props: any) => {
          if (!currentItems.length) return false;
          if (props.event.key === "ArrowDown") {
            selectedIndex = (selectedIndex + 1) % currentItems.length;
            renderList();
            return true;
          }
          if (props.event.key === "ArrowUp") {
            selectedIndex = (selectedIndex - 1 + currentItems.length) % currentItems.length;
            renderList();
            return true;
          }
          if (props.event.key === "Enter") {
            const u = currentItems[selectedIndex];
            if (u) {
              currentCommand?.({ id: u.id, label: u.label });
              return true;
            }
          }
          return false;
        },
        onExit: () => {
          try {
            root?.unmount();
          } finally {
            root = null;
            container?.remove();
            container = null;
          }
        },
      };
    },
  } as const;
}

function sanitizeHtml(html: string): string {
  // Minimal client-side sanitizer: strips <script> and inline event handlers.
  // (Non perfetto, ma riduce i rischi senza dipendenze extra.)
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.querySelectorAll("script").forEach((n) => n.remove());
    doc.querySelectorAll("*").forEach((el) => {
      for (const attr of Array.from(el.attributes)) {
        if (attr.name.toLowerCase().startsWith("on")) el.removeAttribute(attr.name);
      }
      if (el.tagName.toLowerCase() === "a") {
        el.setAttribute("rel", "noreferrer");
        el.setAttribute("target", "_blank");
      }
      if (el.tagName.toLowerCase() === "img") {
        el.setAttribute("loading", "lazy");
      }
    });
    return doc.body.innerHTML;
  } catch {
    return html;
  }
}

export function RichTextViewer({ html, className }: { html: string; className?: string }) {
  const safe = useMemo(() => sanitizeHtml(html), [html]);
  return (
    <div
      className={cn(
        "prose prose-sm max-w-none dark:prose-invert prose-img:rounded-md prose-img:border prose-img:max-w-full",
        className
      )}
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}

type Props = {
  valueHtml: string;
  onChange: (nextHtml: string, mentionedUserIds: string[]) => void;
  mentionUsers: MentionUser[];
  placeholder?: string;
  disabled?: boolean;
  onUploadImage?: (file: File) => Promise<{ src: string; alt?: string }>;
  className?: string;
};

export function RichTextEditor({
  valueHtml,
  onChange,
  mentionUsers,
  placeholder = "Scrivi…",
  disabled,
  onUploadImage,
  className,
}: Props) {
  const latestHtmlRef = useRef<string>(valueHtml);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const suggestion = useMemo(() => buildMentionSuggestion(mentionUsers), [mentionUsers]);

  const editor = useEditor({
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      Placeholder.configure({ placeholder }),
      Image.configure({ inline: true, allowBase64: false }),
      Mention.configure({
        HTMLAttributes: {
          class: "mention rounded-sm bg-primary/10 text-primary px-1",
        },
        suggestion,
        renderLabel({ node }) {
          const label = String(node.attrs?.label || "");
          return `@${label}`;
        },
      }),
    ],
    content: valueHtml || "",
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      latestHtmlRef.current = html;
      const mentioned = collectMentionedUserIds(editor.getJSON());
      onChange(html, mentioned);
    },
  });

  useEffect(() => {
    if (!editor) return;
    if ((valueHtml || "") === (latestHtmlRef.current || "")) return;
    editor.commands.setContent(valueHtml || "", { emitUpdate: false });
    latestHtmlRef.current = valueHtml || "";
  }, [editor, valueHtml]);

  const pickImage = () => {
    if (!onUploadImage) return;
    fileRef.current?.click();
  };

  const onFile = async (file: File | null) => {
    if (!file || !onUploadImage || !editor) return;
    setUploading(true);
    try {
      const { src, alt } = await onUploadImage(file);
      editor.chain().focus().setImage({ src, alt }).run();
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={cn("rounded-lg border bg-background", className)}>
      <div className="flex items-center justify-between px-2 py-1.5 border-b">
        <div className="text-xs text-muted-foreground">
          {uploading ? "Caricamento immagine…" : "@"}{" "}
          {uploading ? null : <span className="text-muted-foreground">per menzionare un collega</span>}
        </div>
        <div className="flex items-center gap-2">
          {onUploadImage ? (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.currentTarget.files?.[0] || null;
                  e.currentTarget.value = "";
                  void onFile(f);
                }}
              />
              <Button type="button" variant="ghost" size="sm" onClick={pickImage} disabled={disabled || uploading}>
                <ImageIcon className="w-4 h-4 mr-2" />
                Immagine
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <div className={cn("px-3 py-2", disabled ? "opacity-70" : "")}>
        <EditorContent editor={editor} className="min-h-[110px]" />
      </div>
    </div>
  );
}


