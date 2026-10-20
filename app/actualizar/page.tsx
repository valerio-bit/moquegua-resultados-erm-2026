import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { AdminPanel } from "@/components/admin/AdminPanel";

export const metadata: Metadata = {
  title: "Actualizar / Publicar",
  description: "Panel para importar, validar, comparar y preparar nuevas versiones de los datos.",
  robots: { index: false, follow: false },
};

export default function ActualizarPage() {
  return (
    <div className="space-y-8">
      <div>
        <Breadcrumbs items={[{ href: "/", label: "Inicio" }, { label: "Actualizar / Publicar" }]} />
        <h1 className="m-0 text-4xl">Actualizar y publicar datos</h1>
        <div className="prose-note mt-3 space-y-2 text-ink-soft">
          <p className="m-0">
            Este panel funciona en tu navegador y no envía datos a ningún servidor. Importa datos nuevos, compáralos, valídalos y
            descárgalos. Si algo no cuadra, no te deja publicar.
          </p>
          <p className="m-0">
            En el equipo del proyecto también puedes usar los scripts: <code>npm run data:fetch</code> (Modo A, consulta ONPE si lo
            permite), <code>npm run data:import -- archivo.json|csv</code> (Modo B) y <code>npm run data:publish</code>.
          </p>
        </div>
      </div>
      <AdminPanel />
    </div>
  );
}
