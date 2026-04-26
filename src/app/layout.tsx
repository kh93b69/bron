import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import { QueryProvider } from "@/components/providers/query-provider";

export const metadata: Metadata = {
  title: {
    default: "CyberBook — бронирование ПК в кибер-клубах",
    template: "%s · CyberBook",
  },
  description:
    "Мгновенное бронирование компьютеров в кибер-аренах. Выбирай место на карте зала и приходи играть.",
  applicationName: "CyberBook",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/favicon.ico" },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: "CyberBook",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#1e1b4b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <QueryProvider>{children}</QueryProvider>
        <Toaster
          richColors
          closeButton
          position="top-center"
          theme="dark"
          toastOptions={{
            style: {
              background: "var(--color-bg-elev)",
              border: "1px solid var(--color-border-strong)",
              color: "var(--color-fg)",
            },
          }}
        />
      </body>
    </html>
  );
}
