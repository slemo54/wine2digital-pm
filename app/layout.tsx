import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Toaster } from "react-hot-toast";
import { AppShell } from "@/components/app-shell";
import { LazyChatbotScripts } from "@/components/lazy-chatbot-scripts";

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
        <Providers>
          <AppShell>{children}</AppShell>
          <Toaster position="top-right" />
        </Providers>
        {/* Chatbot scripts loaded lazily after 3s + idle to avoid INP impact */}
        <LazyChatbotScripts />
      </body>
    </html>
  );
}
