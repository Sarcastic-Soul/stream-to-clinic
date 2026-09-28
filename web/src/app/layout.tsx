import { SerwistProvider } from "@serwist/turbopack/react";
import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Manrope } from "next/font/google";
import { ReportQueueBanner } from "@/components/report-queue-banner";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { LOCALE_SCRIPT } from "@/lib/i18n";
import { THEME_COLOR, THEME_SCRIPT } from "@/lib/theme";
import "./globals.css";

// One family for every language on the site: Manrope and JetBrains Mono both cover Latin and
// Greek, so switching between English, Greek and Italian never changes the typeface.
const sans = Manrope({
  variable: "--font-app-sans",
  subsets: ["latin", "latin-ext", "greek"],
});

const mono = JetBrains_Mono({
  variable: "--font-app-mono",
  subsets: ["latin", "greek"],
});

export const metadata: Metadata = {
  title: { default: "Stream-to-Clinic", template: "%s · Stream-to-Clinic" },
  description: "One Health early warning: citizen stream observations to FHIR health alerts.",
  applicationName: "Stream-to-Clinic",
  appleWebApp: { capable: true, title: "Stream-to-Clinic", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

// One value, kept in step with the chosen theme by the inline script and the
// theme toggle; a media-based list would ignore an explicit light/dark choice.
export const viewport: Viewport = { themeColor: THEME_COLOR.light };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <head>
        {/* Applies the saved theme and language while the HTML is parsed, before the first paint. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: LOCALE_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        {/* No reload when the connection returns: the report queue flushes in place instead. */}
        <SerwistProvider
          swUrl="/serwist/sw.js"
          disable={process.env.NODE_ENV === "development"}
          cacheOnNavigation
          reloadOnOnline={false}
        >
        <a
          href="#main"
          className="sr-only z-50 rounded-md bg-background px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:ring-3 focus:ring-ring/50"
        >
          Skip to content
        </a>
        <SiteHeader />
        <ReportQueueBanner />
        <main id="main" className="flex flex-1 flex-col">
          {children}
        </main>
        <SiteFooter />
        </SerwistProvider>
      </body>
    </html>
  );
}
