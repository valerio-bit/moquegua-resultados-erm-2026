import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { SearchBox } from "@/components/SearchBox";
import { getDataset } from "@/lib/data";
import { buildSearchIndex } from "@/lib/search";

export const metadata: Metadata = {
  title: "Buscar",
  description: "Busca candidatos, organizaciones políticas, provincias y distritos de Moquegua en los resultados 2026.",
  alternates: { canonical: "/buscar/" },
};

export default function BuscarPage() {
  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ href: "/", label: "Inicio" }, { label: "Buscar" }]} />
      <h1 className="m-0 text-4xl">Buscar</h1>
      <div className="max-w-2xl">
        <SearchBox index={buildSearchIndex(getDataset())} autoFocus />
      </div>
    </div>
  );
}
