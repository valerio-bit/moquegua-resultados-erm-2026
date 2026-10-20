"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

export interface TerritoryOption {
  slug: string;
  name: string;
  districts: { slug: string; name: string }[];
}

/** Selector territorial: provincia y, opcionalmente, distrito. */
export function TerritorySelector({ provinces }: { provinces: TerritoryOption[] }) {
  const router = useRouter();
  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const pid = useId();
  const did = useId();
  const current = provinces.find((p) => p.slug === province);
  return (
    <form
      className="grid gap-3 sm:grid-cols-2 sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        if (district) router.push(`/distritos/${district}/`);
        else if (province) router.push(`/provincias/${province}/`);
      }}
    >
      <div>
        <label htmlFor={pid} className="mb-1.5 block text-sm font-medium">
          Provincia
        </label>
        <select
          id={pid}
          value={province}
          onChange={(e) => {
            setProvince(e.target.value);
            setDistrict("");
          }}
          className="w-full rounded-sm border border-rule-strong bg-surface px-3 py-2.5"
          data-testid="province-select"
        >
          <option value="">Elige una provincia</option>
          {provinces.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={did} className="mb-1.5 block text-sm font-medium">
          Distrito (opcional)
        </label>
        <select
          id={did}
          value={district}
          disabled={!current}
          onChange={(e) => setDistrict(e.target.value)}
          className="w-full rounded-sm border border-rule-strong bg-surface px-3 py-2.5 disabled:opacity-60"
          data-testid="district-select"
        >
          <option value="">{current ? "Toda la provincia" : "Primero elige una provincia"}</option>
          {current?.districts.map((d) => (
            <option key={d.slug} value={d.slug}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={!province}
        className="justify-self-start rounded-sm bg-accent px-4 py-2.5 font-semibold sm:col-span-2 text-white hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
      >
        Ver resultados
      </button>
    </form>
  );
}
