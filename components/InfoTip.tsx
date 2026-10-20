"use client";

import { useId, useState } from "react";

/** Explicación accesible: se abre con clic, Enter o Espacio; se cierra con Escape. */
export function InfoTip({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="relative inline-block align-middle">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={`Qué significa: ${label}`}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        onBlur={() => setOpen(false)}
        className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-rule-strong bg-surface text-[0.7rem] font-bold text-ink-soft hover:border-accent hover:text-accent"
      >
        ?
      </button>
      <span
        id={id}
        role="tooltip"
        hidden={!open}
        className="absolute left-0 top-7 z-20 w-72 max-w-[80vw] rounded-sm border border-rule-strong bg-surface p-3 text-left text-sm font-normal leading-snug text-ink shadow-lg"
      >
        {children}
      </span>
    </span>
  );
}
