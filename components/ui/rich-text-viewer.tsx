"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

function sanitizeHtml(html: string): string {
  // Defense-in-depth client-side sanitizer (server-side sanitizer is the source of truth).
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


