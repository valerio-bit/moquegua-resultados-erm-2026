"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ items, vertical = false }: { items: readonly { href: string; label: string }[]; vertical?: boolean }) {
  const pathname = usePathname() ?? "/";
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href.replace(/\/$/, "")));
  return (
    <ul className={vertical ? "m-0 flex list-none flex-col p-0" : "m-0 flex list-none flex-wrap gap-x-1 p-0"}>
      {items.map((item) => {
        const active = isActive(item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={
                vertical
                  ? `block rounded-sm px-3 py-2 text-sm no-underline ${active ? "bg-accent-soft font-semibold text-accent-strong" : "text-ink hover:bg-paper"}`
                  : `-mb-px block border-b-2 px-3 py-2.5 text-sm no-underline ${active ? "border-accent font-semibold text-accent-strong" : "border-transparent text-ink-soft hover:border-rule-strong hover:text-ink"}`
              }
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
