import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-16">
      <h1 className="m-0 text-4xl">No encontramos esta página</h1>
      <p className="mt-3 text-ink-soft">Puede que el territorio o la organización no exista en los resultados de Moquegua.</p>
      <p className="mt-4">
        <Link href="/">Volver al inicio</Link> o <Link href="/buscar/">buscar un candidato, partido o distrito</Link>.
      </p>
    </div>
  );
}
