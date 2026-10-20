import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ProvinceSummary } from "@/components/ProvinceSummary";
import { ProvinceTabs } from "@/components/ProvinceTabs";

export const metadata: Metadata = {
  title: "Provincias",
  description: "Resultados 2026 de las alcaldías provinciales de Mariscal Nieto, General Sánchez Cerro e Ilo (Moquegua), con sus distritos. Fuente: ONPE.",
  alternates: { canonical: "/provincias/" },
};

export default function ProvinciasPage() {
  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ href: "/", label: "Inicio" }, { label: "Provincias" }]} />
      <h1 className="m-0 text-4xl">Provincias de Moquegua</h1>
      <p className="prose-note m-0 text-ink-soft">
        Elige una provincia para ver todas las candidaturas a la alcaldía provincial, los resultados de sus distritos, la
        participación y el Consejo Regional.
      </p>
      <ProvinceTabs />
      <ProvinceSummary />
    </div>
  );
}
