import Link from "next/link";
import { getProvinces } from "@/lib/data";

/** Pestañas de navegación entre provincias (cada pestaña es una página estática). */
export function ProvinceTabs({ current }: { current?: string }) {
  return (
    <nav aria-label="Provincias" className="border-b border-rule-strong">
      <ul className="m-0 flex list-none flex-wrap gap-1 p-0">
        {getProvinces().map((p) => {
          const active = p.slug === current;
          return (
            <li key={p.slug}>
              <Link
                href={`/provincias/${p.slug}/`}
                aria-current={active ? "page" : undefined}
                className={`-mb-px block rounded-t-sm border px-4 py-2.5 text-sm font-semibold no-underline sm:text-base ${
                  active ? "border-rule-strong border-b-paper bg-paper text-ink" : "border-transparent text-ink-soft hover:text-accent"
                }`}
              >
                {p.displayName}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
