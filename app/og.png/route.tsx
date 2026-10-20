import { ImageResponse } from "next/og";
import { getGovernor, getDataset } from "@/lib/data";

export const dynamic = "force-static";

const size = { width: 1200, height: 630 };

/** Imagen para redes sociales (se exporta como /og.png, con extensión, para hosting estático). */
export function GET() {
  const { results, unit } = getGovernor();
  const threshold = getDataset().meta.secondRoundRule.thresholdPct;
  const rows = results.slice(0, 4);
  const scale = Math.max(threshold + 10, (rows[0]?.validVotePct ?? 0) + 5);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#f2f4f3", padding: 64, color: "#1b2330" }}>
        <div style={{ fontSize: 30, color: "#4a5566" }}>Elecciones Regionales y Municipales 2026</div>
        <div style={{ fontSize: 76, fontWeight: 700, marginTop: 8 }}>Resultados en Moquegua</div>
        <div style={{ fontSize: 30, marginTop: 6, color: "#3f2f8f" }}>
          {unit.outcome.kind === "SEGUNDA_VUELTA"
            ? `Gobierno Regional: segunda vuelta (nadie alcanza el ${threshold} % de votos válidos)`
            : "Gobierno Regional: cómputo ONPE"}
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 34, gap: 16, position: "relative" }}>
          {rows.map((r) => (
            <div key={r.organizationCode} style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <div style={{ width: 300, fontSize: 28 }}>{r.organizationShortName ?? r.organizationName.slice(0, 18)}</div>
              <div style={{ display: "flex", width: 640, height: 34, background: "#ffffff" }}>
                <div style={{ width: `${(r.validVotePct / scale) * 100}%`, background: r.status === "SEGUNDA_VUELTA" ? "#3f2f8f" : "#c2ccc9" }} />
              </div>
              <div style={{ fontSize: 28 }}>{`${r.validVotePct.toFixed(1)} %`}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: "auto", fontSize: 24, color: "#4a5566" }}>Fuente de datos electorales: Oficina Nacional de Procesos Electorales (ONPE)</div>
      </div>
    ),
    size,
  );
}
