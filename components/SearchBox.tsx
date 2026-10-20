"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { searchEntries, type SearchEntry } from "@/lib/search";

export function SearchBox({ index, autoFocus = false, initialQuery = "" }: { index: SearchEntry[]; autoFocus?: boolean; initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const id = useId();
  const results = useMemo(() => searchEntries(index, query, 15), [index, query]);
  const active = query.trim().length >= 2;
  return (
    <div role="search" className="block" aria-label="Buscar en los resultados">
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
        Busca un candidato, partido, provincia o distrito
      </label>
      <input
        id={id}
        type="search"
        value={query}
        autoFocus={autoFocus}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Ej.: Torata, Acción Popular, Jakelin"
        autoComplete="off"
        aria-describedby={`${id}-status`}
        className="w-full rounded-sm border border-rule-strong bg-surface px-3 py-2.5 text-base text-ink placeholder:text-ink-faint focus:border-accent"
        data-testid="search-input"
      />
      <p id={`${id}-status`} className="sr-only" aria-live="polite">
        {active ? `${results.length} resultados` : ""}
      </p>
      {active && (
        <ul className="m-0 mt-2 list-none divide-y divide-rule rounded-sm border border-rule bg-surface p-0" data-testid="search-results">
          {results.length === 0 && <li className="px-3 py-2.5 text-sm text-ink-soft">Sin coincidencias. Prueba con otra palabra o sin tildes.</li>}
          {results.map((r) => (
            <li key={`${r.type}-${r.href}-${r.title}`}>
              <Link href={r.href} className="block px-3 py-2.5 text-ink no-underline hover:bg-accent-soft">
                <span className="block font-medium">{r.title}</span>
                <span className="block text-sm text-ink-soft">
                  {r.type} · {r.subtitle}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
