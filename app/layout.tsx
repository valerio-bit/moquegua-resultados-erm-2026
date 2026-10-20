import type { Metadata, Viewport } from "next";
import { Newsreader, Public_Sans } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  display: "swap",
  weight: ["500", "600", "700"],
});

const publicSans = Public_Sans({
  subsets: ["latin"],
  variable: "--font-public-sans",
  display: "swap",
});

const DESCRIPTION =
  "Visualización independiente de los resultados públicos de las Elecciones Regionales y Municipales 2026 en Moquegua: gobierno regional, alcaldías provinciales y distritales, partidos y participación. Fuente: ONPE.";

export const metadata: Metadata = {
  metadataBase: new URL(`${SITE_URL}/`),
  title: { default: SITE_NAME, template: `%s | Moquegua 2026` },
  description: DESCRIPTION,
  applicationName: "Resultados Moquegua 2026",
  openGraph: {
    type: "website",
    locale: "es_PE",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: DESCRIPTION,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Resultados Electorales 2026 — Moquegua: gráfico del Gobierno Regional" }],
  },
  twitter: { card: "summary_large_image", title: SITE_NAME, description: DESCRIPTION, images: ["/og.png"] },
  alternates: { canonical: "./" },
};

export const viewport: Viewport = {
  themeColor: "#0e6168",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${newsreader.variable} ${publicSans.variable}`}>
      <body className="min-h-screen bg-paper antialiased">
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-sm focus:bg-surface focus:px-4 focus:py-2"
        >
          Saltar al contenido
        </a>
        <SiteHeader />
        <main id="contenido" className="mx-auto max-w-6xl px-4 pb-8 pt-6 sm:px-6 sm:pt-8">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
