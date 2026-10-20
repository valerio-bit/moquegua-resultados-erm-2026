import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ExplorerClient } from "@/components/ExplorerClient";
import { getDataset } from "@/lib/data";
import { buildExplorerData } from "@/lib/explorer";

export const metadata: Metadata = {
  title: "Explorar por partido y provincia",
  description:
    "Filtra por partido, provincia y elección: quién encabeza cada distrito y provincia de Moquegua, con cuántos votos, y la clasificación de votantes (hábiles, emitidos, válidos, blancos, nulos y ausentes). Fuente: ONPE.",
  alternates: { canonical: "/explorar/" },
};

export default function ExplorarPage() {
  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ href: "/", label: "Inicio" }, { label: "Explorar" }]} />
      <div>
        <h1 className="m-0 text-4xl">Explorar por partido y provincia</h1>
        <p className="prose-note mt-3 text-ink-soft">
          Elige un partido y míralo provincia por provincia: dónde postula, quién va primero, con cuántos votos y cuánta gente votó.
          Ir primero no es haber ganado.
        </p>
      </div>
      <ExplorerClient data={buildExplorerData(getDataset())} />
    </div>
  );
}
