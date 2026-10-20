import Link from "next/link";
import { getDataset } from "@/lib/data";
import { formatDateTime } from "@/lib/format";
import { SOURCE_LINE, asset } from "@/lib/site";

export function SiteFooter() {
  const { meta } = getDataset();
  return (
    <footer className="mt-16 border-t border-rule bg-surface">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 text-sm text-ink-soft sm:px-6 md:grid-cols-[2fr_1fr]">
        <div className="space-y-2">
          <p className="m-0 font-semibold text-ink" data-testid="source-line">
            {SOURCE_LINE}
          </p>
          <p className="m-0 prose-note">
            Sitio independiente hecho con datos públicos. No es de ONPE, del JNE ni del Estado. Los votos son del conteo de
            ONPE: ir primero no significa haber sido elegido.
          </p>
          <p className="m-0">Datos al {formatDateTime(meta.sourceTimestampMax)}.</p>
        </div>
        <div className="space-y-1.5">
          <p className="m-0">
            <Link href="/fuentes-y-metodologia/">Fuentes y metodología</Link>
          </p>
          <p className="m-0">
            <a href={asset("/datos/dataset.json")}>Descargar datos (JSON)</a> · <a href={asset("/datos/resultados.csv")}>CSV</a>
          </p>
          <p className="m-0 break-all text-xs">Snapshot {meta.snapshotId} · SHA-256 {meta.snapshotHash.slice(0, 16)}…</p>
        </div>
      </div>
    </footer>
  );
}
