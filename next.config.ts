import type { NextConfig } from "next";

// Exportación estática: el sitio público se genera completo en `out/`
// y puede alojarse gratis (GitHub Pages, Netlify, Cloudflare Pages, Vercel).
// En GitHub Pages el sitio vive en /<repositorio>/: el workflow define NEXT_PUBLIC_BASE_PATH.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath: basePath || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
