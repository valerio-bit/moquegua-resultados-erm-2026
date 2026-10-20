import Link from "next/link";
import { NAV } from "@/lib/site";
import { NavLinks } from "./NavLinks";

export function SiteHeader() {
  return (
    <header className="border-b border-rule bg-surface">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="group flex items-baseline gap-2 text-ink no-underline">
          <span className="font-serif text-xl font-semibold tracking-tight sm:text-2xl">Moquegua 2026</span>
          <span className="hidden text-sm text-ink-soft sm:inline">Resultados electorales</span>
        </Link>
        <details className="relative xl:hidden">
          <summary className="cursor-pointer list-none rounded-sm border border-rule-strong px-3 py-1.5 text-sm font-medium [&::-webkit-details-marker]:hidden">
            Menú
          </summary>
          <nav aria-label="Secciones" className="absolute right-0 z-30 mt-2 w-64 rounded-sm border border-rule-strong bg-surface p-2 shadow-lg">
            <NavLinks items={NAV} vertical />
          </nav>
        </details>
      </div>
      <nav aria-label="Secciones principales" className="hidden border-t border-rule xl:block">
        <div className="mx-auto max-w-6xl px-6">
          <NavLinks items={NAV} />
        </div>
      </nav>
    </header>
  );
}
