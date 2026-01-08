import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Toaster } from "react-hot-toast";
import { AppShell } from "@/components/app-shell";

const inter = Inter({ subsets: ["latin"] });

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL || "http://localhost:3000"),
  title: "Wine2Digital PM - Project Management Made Simple",
  description: "Modern project management tool with Kanban boards, task tracking, and team collaboration features.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "Wine2Digital PM - Project Management Made Simple",
    description: "Modern project management tool with Kanban boards, task tracking, and team collaboration.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Script src="https://apps.abacus.ai/chatllm/appllm-lib.js" strategy="afterInteractive" />
        {/* Elfsight AI Chatbot | pm.wine2digital */}
        <Script src="https://elfsightcdn.com/platform.js" strategy="afterInteractive" />
        <div
          className="elfsight-app-57b93af2-30e0-4b47-ab37-53e380b55c5a"
          data-elfsight-app-lazy="true"
        />
        <Providers>
          <AppShell>{children}</AppShell>
          <Toaster position="top-right" />
        </Providers>
      </body>
    </html>
  );
}
