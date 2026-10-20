# Resumen final — Resultados Electorales 2026, Moquegua

Fuente de datos electorales: Oficina Nacional de Procesos Electorales (ONPE). Snapshot publicado `2026-10-20_13-58-37` · SHA-256 de contenido `3f870a617f960994382398c7365b479d11feba8ae127351afb1c1df3aefd50a8`. Cortes ONPE incluidos: del 20/10/2026 02:46 (Lima) al 20/10/2026 08:30 (Lima).

## 1. Qué se construyó

- Aplicación Next.js 16 + TypeScript + Tailwind 4 + Zod, exportada como sitio estático (62 páginas) apto para hosting gratuito (GitHub Pages incluido).
- Secciones: Inicio, Gobierno Regional, Provincias (pestañas Mariscal Nieto / General Sánchez Cerro / Ilo), Distritos (21 páginas), Partidos (panel + 23 fichas), Participación y ausentismo, Fuentes y metodología, Actualizar / Publicar, Buscar.
- Pipeline de datos: Modo A (`npm run data:fetch`, cliente con caché, ritmo máximo, backoff y detección de WAF sin evasión) y Modo B (`npm run data:import` y panel web) con validación previa, snapshots inmutables, manifiestos y comparación de versiones.
- Validación: 21/21 controles superados, 0 críticos fallidos → versión publicable: sí. `npm run build` se detiene si falla un control crítico.

## 2. Dataset de Moquegua

- Elecciones: 1 gobierno regional, 3 consejo regional (por provincia), 3 alcaldías provinciales, 18 alcaldías distritales. Candidaturas: 164. Organizaciones: 23. Ámbitos de participación: 25.
- Ubigeo verificado en el catálogo de ONPE: MOQUEGUA = `170000` (provincias `170100` Mariscal Nieto, `170200` General Sánchez Cerro, `170300` Ilo). Las capitales (Moquegua, Omate, Ilo) no tienen alcaldía distrital en la jerarquía de ONPE: no se duplicaron.

### Gobierno Regional

Actas contabilizadas: 572 de 572 (100 %). Válidos 115,500, blancos 9,094, nulos 6,812, emitidos 131,406, electores hábiles 166,170.

| Puesto | Fórmula (gobernador) | Organización | Votos | % válidos | Estado |
|---|---|---|---:|---:|---|
| 1 | Abraham Alejandro Cardenas Romero | Acción Popular | 30,051 | 26.018 % | Segunda vuelta |
| 2 | Juan Luis Herrera Chejo | Partido Democrático Somos Perú | 29,054 | 25.155 % | Segunda vuelta |
| 3 | Jaime Alberto Rodriguez Villanueva | Kausachun | 20,274 | 17.553 % | Cómputo ONPE |
| 4 | Percy Huancapaza Chambi | Progresemos | 8,799 | 7.618 % | Cómputo ONPE |
| 5 | Pedro Juan Tito Calizaya | Partido Popular Cristiano - PPC | 6,360 | 5.506 % | Cómputo ONPE |
| 6 | Milar Godofredo Zenteno Mejia | Partido Político Perú Primero | 5,658 | 4.899 % | Cómputo ONPE |
| 7 | Victor Catunta Cuayla | Juntos por el Perú | 5,544 | 4.800 % | Cómputo ONPE |
| 8 | Luis Dante Zubia Cortez | Podemos Perú | 5,027 | 4.352 % | Cómputo ONPE |
| 9 | Rodolfo Oreste Baldi Burga | Vamos Moquegua | 1,925 | 1.667 % | Cómputo ONPE |
| 10 | Hugo Isaias Quispe Mamani | Partido del Buen Gobierno | 1,894 | 1.640 % | Cómputo ONPE |
| 11 | Jorge Luis Lama Cordova | Alianza Electoral Venceremos | 914 | 0.791 % | Cómputo ONPE |

Ninguna fórmula alcanza el 30 % de votos válidos con el 100 % de actas: corresponde segunda elección regional (2026-12-06, fuente: https://elperuano.pe/noticia/306580-jne-oficializa-el-6-de-diciembre-como-fecha-de-la-segunda-vuelta-regional). **No hay gobernador electo** y no se marcó ninguna proclamación.

### Alcaldías provinciales

| Provincia | Primer lugar | Organización | % válidos | Actas | Estado |
|---|---|---|---:|---:|---|
| Mariscal Nieto | Jakelin Galvan Ninaraqui Pelaiza | Acción Popular | 29.194 % | 100 % | Primer lugar virtual |
| General Sánchez Cerro | Prescilio Alejandro Mamani Eugenio | Partido Político Perú Primero | 28.072 % | 100 % | Primer lugar virtual |
| Ilo | Blademir Acero Oliva | Partido Patriótico del Perú | 25.998 % | 99.567 % | Primer lugar parcial |

### Alcaldías distritales

| Provincia | Distrito | Primer lugar | Organización | % válidos | Actas | Estado |
|---|---|---|---|---:|---:|---|
| Mariscal Nieto | Moquegua | — (capital: alcaldía provincial) | — | — | — | — |
| Mariscal Nieto | Carumas | Julio Armando Valdez Naventa | Alianza para el Progreso | 56.418 % | 100 % | Primer lugar virtual |
| Mariscal Nieto | Cuchumbaya | Henry Yonel Vizcarra Quispe | Acción Popular | 51.142 % | 100 % | Primer lugar virtual |
| Mariscal Nieto | San Cristóbal | Edy Noe Mamani Vilca | Partido Político Perú Primero | 41.701 % | 100 % | Primer lugar virtual |
| Mariscal Nieto | Torata | Arla Nohelia Flor Cruz | Primero la Gente - Comunidad, Ecología, Libertad y Progreso | 44.307 % | 100 % | Primer lugar virtual |
| Mariscal Nieto | Samegua | Renso Milthon Florencio Quiroz Vargas | Alianza para el Progreso | 44.038 % | 96.154 % | Primer lugar parcial |
| Mariscal Nieto | San Antonio | Jose Ricardo Ordoñez Huanca | Ahora Nación - AN | 43.732 % | 100 % | Primer lugar virtual |
| General Sánchez Cerro | Omate | — (capital: alcaldía provincial) | — | — | — | — |
| General Sánchez Cerro | Coalaque | Juan Eleodoro Banegas Ramos | Partido Político Perú Primero | 34.143 % | 100 % | Primer lugar virtual |
| General Sánchez Cerro | Chojata | Wilson Hilario Mamani Gallegos | Partido Político Perú Primero | 38.366 % | 100 % | Primer lugar virtual |
| General Sánchez Cerro | Ichuña | Orlando German Casilla Maldonado | Acción Popular | 34.223 % | 100 % | Primer lugar virtual |
| General Sánchez Cerro | La Capilla | Acencion Cruz Alejo Garcia | Acción Popular | 64.613 % | 100 % | Primer lugar virtual |
| General Sánchez Cerro | Lloque | Marina Calizaya Cohaguila | Alianza para el Progreso | 39.227 % | 100 % | Primer lugar virtual |
| General Sánchez Cerro | Matalaque | Christian Henry Condori Larico | Progresemos | 36.450 % | 100 % | Primer lugar virtual |
| General Sánchez Cerro | Puquina | Wacner Lopez Mamani | Partido Político Perú Primero | 45.911 % | 100 % | Primer lugar virtual |
| General Sánchez Cerro | Quinistaquillas | Eleuterio Caytano Coaquira | Partido Político Perú Primero | 55.405 % | 100 % | Primer lugar virtual |
| General Sánchez Cerro | Ubinas | Dionicio Elmer Mamani Cuevas | Partido Popular Cristiano - PPC | 27.703 % | 100 % | Primer lugar virtual |
| General Sánchez Cerro | Yunga | Berly Godofredo Manuel Ajahuana | Acción Popular | 32.918 % | 100 % | Primer lugar virtual |
| Ilo | Ilo | — (capital: alcaldía provincial) | — | — | — | — |
| Ilo | El Algarrobal | Shandee Riquelme Yujra Cutipa | Partido Político Perú Primero | 27.822 % | 100 % | Primer lugar virtual |
| Ilo | Pacocha | Robert Glenn Valdivia Manrique | Acción Popular | 42.165 % | 100 % | Primer lugar virtual |

### Participación y ausentismo

| Ámbito | Hábiles | Votaron | Ausentes | Pendientes | Participación | Ausentismo |
|---|---:|---:|---:|---:|---:|---:|
| Región Moquegua | 166,170 | 131,211 | 34,659 | 300 | 78.962 % | 20.858 % |
| Provincia Mariscal Nieto | 81,888 | 66,004 | 15,884 | 0 | 80.603 % | 19.397 % |
| Provincia General Sánchez Cerro | 15,682 | 12,109 | 3,573 | 0 | 77.216 % | 22.784 % |
| Provincia Ilo | 68,600 | 53,098 | 15,202 | 300 | 77.402 % | 22.160 % |

Los 300 electores pendientes corresponden a un acta enviada al JEE en el distrito de Ilo (elección provincial); no se cuentan como ausentes y el dato se marca provisional.


## 3. Qué información proviene directamente de ONPE

Todos los números electorales: votos por candidatura, porcentajes de votos válidos y emitidos, votos válidos, en blanco, nulos y emitidos, actas (total, contabilizadas, enviadas al JEE, pendientes), fechas de actualización, electores hábiles, asistentes y ausentes por región, provincia y distrito, nombres de candidatos y organizaciones, códigos de organización y de ubigeo, y los símbolos de las organizaciones. Servicios: `presentacion-backend/resumen-general/totales`, `resumen-general/participantes`, `eleccion-*/participantes-ubicacion-geografica-nombre`, `participacion-ciudadana/totales|ubigeos-total|mapa-calor`, `proceso/proceso-electoral-activo`, `assets/ubig/v1.json` y `assets/img-reales/partidos/{código}.png`.

**Método:** los servicios están detrás de AWS WAF y responden 403/desafío a scripts. No se evadió la protección: las respuestas se capturaron navegando el portal público en un navegador (Modo B) y se guardaron sin alterar (excepto el DNI de candidatos, reemplazado por `[omitido]`). El script de Modo A (`npm run data:fetch`) se probó contra ONPE: detecta el bloqueo, se detiene con código 2 y no crea carpetas vacías.

**Derivado (cálculo propio, documentado):** ranking; estados (`PRIMER_LUGAR_VIRTUAL`, `SEGUNDA_VUELTA`) a partir del avance de actas y la regla legal; electores pendientes (hábiles − votaron − ausentes); porcentajes de participación/ausentismo recalculados (coinciden con ONPE); hash SHA-256; nombres de presentación de organizaciones (editorial, sin cambiar la denominación oficial).

**Fuente no ONPE:** la regla de segunda vuelta regional (30 % de votos válidos) y su fecha (6 de diciembre de 2026) se tomaron de El Peruano, que informa el Acuerdo del Pleno del JNE del 7 de octubre de 2026.

## 4. Datos que no pudieron verificarse

- **Proclamaciones del JNE/JEE**: no se verificó ninguna; por eso ningún resultado aparece como proclamado ni como autoridad electa. `data/reference/proclamaciones-jne.csv` está vacío y listo para registrarlas con su fuente.
- **Convocatoria oficial de la segunda vuelta en Moquegua**: la regla y la fecha general están verificadas; la inclusión específica de Moquegua se deduce del cómputo ONPE al 100 % (26.018 % < 30 %). Falta la proclamación del JEE.
- **Votos impugnados**: ONPE no los publica por separado en estos servicios.
- **Consejo Regional**: ONPE no publica nombres de listas ni asignación de escaños en estos servicios; no se calcularon escaños.
- **Candidaturas sin nombre**: ONPE publica votos sin nombre de candidato para 9 candidaturas municipales (p. ej., Acción Popular en la provincia de Ilo, Progresemos en Ubinas); se muestran como "Sin nombre en ONPE".
- **Nombres con "null"**: 2 nombres llegan con el texto literal `null` como apellido (Richard Guillermo Revollar, Alejandro Jose Mendoza); se omite ese texto al mostrarlos y se conserva el original.
- **Actas pendientes**: provincia de Ilo (alcaldía provincial, 1 acta en el JEE; 300 electores pendientes en participación) y distrito de Samegua (1 acta en el JEE). Se muestran como resultados parciales.
- **Logos del JNE (prioridad 1)**: el buscador de símbolos del JNE exige CAPTCHA, por lo que no se automatizó. Los 23 símbolos provienen de la interfaz pública de ONPE (prioridad 3), con URL y SHA-256 (`data/reference/logos-manifest.csv`). Las imágenes de referencia aportadas por el usuario no se usaron como oficiales por no tener fuente verificable.
- **Rutas documentadas `/ubigeos/*` y `/actas/*`**: la interfaz de ONPE no las usó durante la captura; su esquema no se verificó.
- **Cortes distintos**: el gobierno regional y la participación corresponden a cortes de las 02:46–02:55 (Lima) y el resto a las 08:25–08:30 del 20/10/2026. Cada registro conserva su `sourceTimestamp`.

## 5. Pruebas y build

| Comando | Resultado |
|---|---|
| `npm run lint` | OK, 0 advertencias |
| `npm run typecheck` | OK |
| `npm run test` (Vitest) | 46/46 pruebas OK (estados, participación, validaciones, importación CSV/JSON, comparación, buscador, cliente ONPE y dataset real) |
| `npm run test:e2e` (Playwright, escritorio y móvil) | 53 OK, 1 omitida a propósito (teclado solo en escritorio): Inicio, Gobierno Regional, Mariscal Nieto, General Sánchez Cerro, Ilo, distritos (Torata, Omate, Samegua), Partidos, Participación/Ausentismo, Fuentes, SEO y Actualizar/Publicar. El buscador encuentra Jakelin, Blademir, Prescilio, Torata y Pacocha; "Segunda vuelta" se muestra en el Gobierno Regional. |
| `npm run build` | OK: validación 21/21 y 62 páginas estáticas en `out/` |

## 6. Despliegue en producción (gratis)

1. Sube el proyecto a un repositorio público de GitHub (rama `main`).
2. En **Settings → Pages**, elige **Source: GitHub Actions**.
3. El flujo `.github/workflows/deploy.yml` instala, ejecuta lint, pruebas y build con la ruta base del repositorio y publica en `https://<usuario>.github.io/<repositorio>/`.
4. Para actualizar datos: `npm run data:import -- archivos --publish` (o el panel Actualizar / Publicar) y `git push`. Si una validación crítica falla, el build se detiene y el sitio anterior sigue publicado.

Alternativas gratuitas: Cloudflare Pages o Netlify (build `npm run build`, salida `out`) y Vercel Hobby. Detalle en el README.

## 7. Entregables

- Proyecto: `moquegua-resultados-erm-2026/`
- ZIP: `moquegua-resultados-erm-2026.zip` (sin `node_modules` ni compilados; `npm install` lo reconstruye)
- Datos: `data/raw/2026-10-20_07-47-00/` (capturas), `data/snapshots/`, `data/processed/dataset.json`
- Logos: `public/logos/partidos/` (23) y `data/reference/logos-manifest.csv`
- Reportes: `reports/validation-report.json`, `reports/data-dictionary.md`, este resumen
