"use client";

import { useEffect, useState } from "react";
import Script from "next/script";

/**
 * Lazy chatbot scripts loader.
 * Defers loading of third-party chatbot scripts until:
 * 1. The page has been interactive for at least 3 seconds
 * 2. The browser is idle (via requestIdleCallback)
 *
 * This prevents these heavy scripts from impacting INP and initial page load.
 */
export function LazyChatbotScripts() {
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    // Don't load during SSR or if already loaded
    if (typeof window === "undefined") return;

    let cancelled = false;

    const loadAfterIdle = () => {
      if (cancelled) return;

      // Use requestIdleCallback if available, otherwise setTimeout
      if ("requestIdleCallback" in window) {
        (window as any).requestIdleCallback(
          () => {
            if (!cancelled) setShouldLoad(true);
          },
          { timeout: 5000 }
        );
      } else {
        setTimeout(() => {
          if (!cancelled) setShouldLoad(true);
        }, 1000);
      }
    };

    // Wait 3 seconds after page load before even considering loading
    const timer = setTimeout(loadAfterIdle, 3000);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  if (!shouldLoad) return null;

  return (
    <>
      {/* Abacus AI Chatbot - loaded lazily */}
      <Script
        src="https://apps.abacus.ai/chatllm/appllm-lib.js"
        strategy="lazyOnload"
      />
      {/* Elfsight AI Chatbot - loaded lazily */}
      <Script
        src="https://elfsightcdn.com/platform.js"
        strategy="lazyOnload"
      />
      {/* Elfsight widget container */}
      <div
        className="elfsight-app-57b93af2-30e0-4b47-ab37-53e380b55c5a"
        data-elfsight-app-lazy="true"
      />
    </>
  );
}
