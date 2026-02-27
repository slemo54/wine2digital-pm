import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Toaster } from "react-hot-toast";
import { AppShell } from "@/components/app-shell";

const inter = Inter({ subsets: ["latin"] });

// Force dynamic to prevent prerendering issues with useSearchParams
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
      <head>
        {/* Google Tag Manager - HEAD */}
        <Script id="google-tag-manager" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-NLK65L2B');`}
        </Script>
        {/* End Google Tag Manager */}

        {/* Microsoft Clarity */}
        <Script id="microsoft-clarity" strategy="lazyOnload">
          {`(function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", "v1evkfgd79");`}
        </Script>
      </head>
      <body className={inter.className}>
        {/* Google Tag Manager (noscript) - BODY */}
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-NLK65L2B"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        {/* End Google Tag Manager (noscript) */}

        {/* Elfsight AI Chatbot | pm.wine2digital */}
        <Script src="https://elfsightcdn.com/platform.js" strategy="lazyOnload" />
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
