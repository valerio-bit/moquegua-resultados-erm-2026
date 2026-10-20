# Resultados Electorales 2026 — Moquegua

Visualización independiente de los resultados públicos de las **Elecciones Regionales y Municipales 2026** (ERM2026) en el departamento de Moquegua, Perú: gobierno regional, consejo regional, alcaldías provinciales y distritales, partidos y participación.

**Fuente de datos electorales: Oficina Nacional de Procesos Electorales (ONPE).**

> Este sitio no es un portal de ONPE, del JNE ni de ninguna entidad pública, y no usa sus logotipos institucionales. Las cifras son del cómputo de ONPE. Un primer lugar en el cómputo **no** equivale a autoridad electa ni proclamada: solo se marca "proclamado" con una fuente verificable del JNE/JEE.

## Qué incluye

- 25 elecciones de Moquegua: gobernador regional (11 fórmulas), consejo regional (3 circunscripciones), 3 alcaldías provinciales y 18 alcaldías distritales (las capitales provinciales no duplican alcaldía).
- 164 candidaturas con votos, porcentajes, ranking y estado; votos válidos, blancos, nulos y emitidos; avance de actas y actas en el JEE.
- Participación y ausentismo de la región, las 3 provincias y los 21 distritos, sin confundir ausentismo con votos blancos, nulos o impugnados.
- Segunda vuelta regional: regla del 30 % de votos válidos (JNE, segunda elección del 6 de diciembre de 2026).
- Símbolos de las 23 organizaciones con procedencia y SHA-256.
- Panel **Actualizar / Publicar** (en el navegador): importar JSON/CSV, comparar, validar, generar snapshot, generar versión publicable (bloqueada si falla una validación crítica) y exportar ZIP.
- Datos abiertos: `/datos/dataset.json`, `/datos/resultados.csv`, `/datos/participacion.csv`.

## Requisitos

- Node.js 22.12 o superior (probado con Node 24) y npm.

## Uso

```bash
npm install
npm run dev        # http://localhost:3000
npm run test       # pruebas unitarias (Vitest)
npm run build      # valida los datos y genera el sitio estático en out/
```

Otros comandos:

| Comando | Qué hace |
|---|---|
| `npm run lint` | ESLint sin advertencias. |
| `npm run typecheck` | TypeScript estricto. |
| `npm run test:e2e` | Pruebas Playwright sobre `out/` (requiere `npm run build` y `npx playwright install chromium`). |
| `npm run serve` | Sirve `out/` en http://localhost:4173. |
| `npm run data:fetch` | **Modo A**: consulta los servicios públicos de ONPE con caché, ritmo máximo y backoff. Si ONPE bloquea (WAF/CAPTCHA) se detiene sin evadirlo. |
| `npm run data:import -- archivo.json` / `archivo.csv` | **Modo B**: importa capturas JSON o un CSV de resultados; valida antes de aceptar. |
| `npm run data:build` | Construye un snapshot desde la última carpeta `data/raw/`. |
| `npm run data:publish` | Igual, y publica en `data/processed/dataset.json` solo si no hay fallos críticos. |
| `npm run data:validate` | Valida la versión publicada y escribe `reports/validation-report.json`. |
| `npm run data:logos` | Descarga los símbolos (JNE si hay mapeo → sitio oficial → interfaz ONPE) y escribe `data/reference/logos-manifest.csv`. |
| `npm run export:zip` | Crea `../moquegua-resultados-erm-2026.zip` sin dependencias ni compilados. |

## Cómo se obtienen los datos

1. La plataforma pública de ONPE (`https://resultadoelectoral.onpe.gob.pe`) carga sus datos desde `/presentacion-backend`. Servicios usados: `resumen-general/totales`, `resumen-general/participantes`, `eleccion-*/participantes-ubicacion-geografica-nombre` (blancos y nulos), `participacion-ciudadana/totales` y el catálogo `assets/ubig/v1.json` (allí MOQUEGUA = `170000`).
2. Los servicios están protegidos por AWS WAF y rechazan scripts (HTTP 403/desafío). **No se evade la protección.** Esta versión se capturó navegando el portal con un navegador y guardando las respuestas que la propia página carga (Modo B). Cada respuesta conserva su URL, hora de captura y hora de corte de ONPE.
3. Cada importación crea `data/raw/<UTC>/` y `data/snapshots/<UTC>.json` + manifiesto, sin sobrescribir los anteriores.
4. `npm run build` falla si la versión publicada no supera las validaciones críticas (sumas, conciliación de emitidos, participación, estados, hash, cobertura territorial).

Detalle de campos: [`reports/data-dictionary.md`](reports/data-dictionary.md). Resultado de la validación: [`reports/validation-report.json`](reports/validation-report.json). Resumen del trabajo: [`reports/resumen-final.md`](reports/resumen-final.md).

## Actualizar los datos

**Si ONPE permite la consulta automatizada:**

```bash
npm run data:fetch -- --publish
```

**Si la bloquea (lo habitual):** abre el portal de ONPE en tu navegador, copia o exporta las respuestas JSON (formato de captura descrito en el diccionario de datos) o prepara un CSV con el formato de `/datos/resultados.csv`, y:

```bash
npm run data:import -- ruta/a/capturas.json --publish
```

También puedes hacerlo desde la página **Actualizar / Publicar** del sitio: importa, compara, valida y descarga `dataset.json`; luego reemplaza `data/processed/dataset.json` y haz commit. Una importación parcial (por ejemplo, un solo distrito) reemplaza solo ese ámbito y conserva el resto con su propio corte.

Para marcar una candidatura como **proclamada**, agrega la resolución en `data/reference/proclamaciones-jne.csv` con su URL de `jne.gob.pe` y ejecuta `npm run data:publish`.

## Despliegue gratuito en producción

El sitio es 100 % estático (`out/`), así que se publica gratis.

### GitHub Pages (recomendado; incluido)

1. Crea un repositorio público en GitHub, por ejemplo `moquegua-resultados-erm-2026`, y sube el proyecto:

   ```bash
   git init
   git add .
   git commit -m "Resultados ERM 2026 Moquegua"
   git branch -M main
   git remote add origin https://github.com/<tu-usuario>/moquegua-resultados-erm-2026.git
   git push -u origin main
   ```

2. En GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. El flujo `.github/workflows/deploy.yml` ejecuta lint, pruebas y build con la ruta base del repositorio y publica en:
   `https://<tu-usuario>.github.io/moquegua-resultados-erm-2026/`
4. Cada `git push` a `main` vuelve a publicar. Si una validación crítica falla, el build se detiene y el sitio anterior sigue en línea.

### Alternativas gratuitas

- **Cloudflare Pages / Netlify**: comando de build `npm run build`, carpeta de salida `out`, variable `NEXT_PUBLIC_SITE_URL` con tu URL. Sin `NEXT_PUBLIC_BASE_PATH`.
- **Vercel (plan Hobby)**: importa el repositorio; Next.js se detecta solo. Define `NEXT_PUBLIC_SITE_URL`.
- **Dominio propio**: deja `NEXT_PUBLIC_BASE_PATH` vacío y configura `NEXT_PUBLIC_SITE_URL=https://tu-dominio`.

Variables disponibles en [`.env.example`](.env.example).

## Estructura

```
app/                 páginas (Inicio, Gobierno Regional, Provincias, Distritos, Partidos,
                     Participación, Fuentes y metodología, Actualizar / Publicar, Buscar)
components/          interfaz (tablas, gráfico del umbral, participación, panel de administración)
lib/onpe/            cliente ONPE (ritmo, caché, backoff, detección de WAF) y rutas
lib/transforms/      capturas ONPE → dataset, estados electorales, participación
lib/validation/      validaciones críticas y advertencias
lib/import/          importación JSON/CSV (Modo B) y fusión parcial
scripts/             fetch-onpe, build-dataset, fetch-logos, validate-data, export-package,
                     import-manual, prepare-public-data
data/raw|processed|reference|snapshots
public/logos/partidos/
reports/             validation-report.json, data-dictionary.md, resumen-final.md
tests/unit|e2e
```

## Accesibilidad y SEO

`lang="es"`, enlace para saltar al contenido, foco visible, tablas con `caption` y encabezados, gráficos con texto alternativo, contraste AA, navegación por teclado, sitemap, robots, Open Graph y metadatos por territorio.

## Licencia

Código: MIT. Datos electorales: ONPE (información pública). Los símbolos de las organizaciones pertenecen a sus titulares y se reproducen sin modificaciones con fines informativos.
