# Diccionario de datos

Proyecto: visualización independiente de los resultados públicos de las Elecciones Regionales y Municipales 2026 (ERM2026) en el departamento de Moquegua.
Fuente de datos electorales: Oficina Nacional de Procesos Electorales (ONPE).

Convenciones:

- Fechas en ISO 8601 con zona horaria (UTC, sufijo `Z`). La interfaz las muestra en hora de Lima (UTC−5).
- Porcentajes en escala 0–100 con hasta 3 decimales, como los publica ONPE.
- Códigos de ubigeo: los de ONPE (6 dígitos). Moquegua es `170000` en ONPE (no es el código INEI).
- "Origen" indica si el dato viene **directo de ONPE**, es **derivado** (cálculo propio, explicado) o es **editorial** (rótulo de presentación).

## 1. Flujo y archivos

| Ruta | Contenido | Se sobrescribe |
|---|---|---|
| `data/raw/<YYYY-MM-DD_HH-mm-ss>/*.json` | Capturas de respuestas ONPE (formato de captura, §2). La marca de tiempo es UTC. | Nunca |
| `data/snapshots/<id>.json` | Dataset completo generado en ese momento (§3). | Nunca (escritura exclusiva) |
| `data/snapshots/<id>.manifest.json` | Manifiesto del snapshot (§4). | Nunca |
| `data/processed/dataset.json` | Versión publicada (copia del último snapshot que pasó la validación crítica). | Solo al publicar |
| `data/reference/*` | Referencias: organizaciones, logos, reglas, territorio, proclamaciones (§6). | Edición manual |
| `reports/validation-report.json` | Validación de la versión publicada (§7). | En cada validación |
| `reports/validations/<id>.json` | Validación de cada snapshot. | Nunca |
| `public/datos/*` | Datos abiertos que sirve el sitio: `dataset.json`, `resultados.csv`, `participacion.csv`, `validation-report.json`, `logos-manifest.csv`. Se regeneran en cada build. | En cada build |

## 2. Formato de captura (`data/raw`)

```json
{
  "captureMethod": "manual-browser-capture | onpe-api | manual-import",
  "capturedAt": "2026-10-20T08:02:46Z",
  "pageTimestamp": "2026-10-20T07:52:00Z",
  "pageNote": "texto libre",
  "captures": [
    { "kind": "totales", "electionId": 1, "scope": { "department": "170000", "province": "…", "district": "…" },
      "sourceUrl": "https://resultadoelectoral.onpe.gob.pe/presentacion-backend/…", "response": { "…": "respuesta ONPE" } }
  ]
}
```

| Campo | Descripción |
|---|---|
| `captureMethod` | `manual-browser-capture`: respuestas que cargó la interfaz pública de ONPE en un navegador. `onpe-api`: script `fetch-onpe` (Modo A). `manual-import`: importación manual (Modo B). |
| `capturedAt` | Hora UTC en que se guardó la captura. |
| `pageTimestamp` | Hora de corte mostrada por ONPE ("ACTUALIZADO AL …") cuando la respuesta no la incluye (participación). |
| `kind` | `totales`, `participantes`, `ubicacion-geografica`, `participacion-totales`, `participacion-hijos`, `participacion-mapa-calor`, `mapa-calor-actas`, `mesas`. |
| `response` | Cuerpo JSON de ONPE. `dniCandidato` se reemplaza por `"[omitido]"` (minimización de datos personales). |
| `reconstruction` | Presente solo si la respuesta se reconstruyó parcialmente (ver nota en `30-blancos-nulos.json`: las filas de organizaciones se toman de `participantes` y las de blancos/nulos se transcriben de la respuesta). |

## 3. Dataset (`dataset.json`)

### 3.1 `meta`

| Campo | Tipo | Origen | Descripción |
|---|---|---|---|
| `source` | `"ONPE"` | — | Fuente. |
| `processName`, `processId`, `electionDate` | texto, número, fecha | ONPE (`proceso-electoral-activo`) | ERM2026, id 4, 2026-10-04. |
| `departmentUbigeo` | texto | ONPE (`assets/ubig/v1.json`) | Código ONPE de Moquegua (`170000`). |
| `generatedAt`, `snapshotId` | fecha, texto | derivado | Momento de generación. |
| `rawFolder`, `captureMethods` | texto | derivado | Carpeta de capturas y métodos usados. |
| `sourceTimestampMin/Max` | fecha | ONPE | Corte ONPE más antiguo y más reciente incluidos. |
| `snapshotHash` | SHA-256 | derivado | Hash del contenido canónico (territorio, organizaciones, elecciones, resultados, participación). |
| `secondRoundRule` | objeto | JNE vía El Peruano | Umbral (30 %), fecha de la segunda elección y fuente. |

### 3.2 `territory`

| Campo | Origen | Descripción |
|---|---|---|
| `department`, `provinces[]`, `districts[]` | ONPE (`assets/ubig/v1.json`) | Jerarquía detectada a partir del registro `MOQUEGUA` (no se presupone el código). |
| `displayName`, `slug` | editorial / derivado | Nombre con mayúsculas y tildes para mostrar; identificador de URL. |
| `hasDistrictElection` | ONPE (opciones del selector "Municipal distrital") | `false` en las capitales provinciales (Moquegua, Omate, Ilo): su alcaldía es la provincial. |
| `isProvincialCapital` | derivado | Inverso de lo anterior. |

### 3.3 `elections[]` (una elección en una circunscripción)

| Campo | Tipo | Origen (campo ONPE) | Descripción |
|---|---|---|---|
| `id` | texto | derivado | `<electionId>-<ubigeo>`, p. ej. `4-170105`. |
| `electionId` | 1–4 | ONPE | 1 gobernador, 2 consejo regional, 3 alcaldía provincial, 4 alcaldía distrital. |
| `level` | `REGIONAL`/`PROVINCIAL`/`DISTRICT` | derivado | 1 y 2 son regionales (2 se vota por provincia). |
| `validVotes` | entero | `totalVotosValidos` | Votos por organizaciones. |
| `blankVotes` | entero | fila código `80` "VOTOS EN BLANCO" | |
| `nullVotes` | entero | fila código `81` "VOTOS NULOS" | |
| `challengedVotes` | entero o `null` | — | ONPE no publica impugnados por separado en estos servicios. |
| `votesCast` | entero | `totalVotosEmitidos` | Emitidos = válidos + blancos + nulos (esquema ONPE). |
| `eligibleVoters` | entero | `participacion-ciudadana.totalElectoresHabiles` del mismo ámbito | Padrón del ámbito. |
| `turnoutPct` | % | `participacionCiudadana` | Emitidos ÷ hábiles según ONPE para esa elección. |
| `totalActs`, `countedActs`, `countedActsPct` | entero, entero, % | `totalActas`, `contabilizadas`, `actasContabilizadas` | |
| `jeeActs` | entero | `enviadasJee` | Actas observadas enviadas al JEE. |
| `pendingActs` | entero | `pendientesJee` | Actas pendientes. |
| `processedActs` | entero | derivado | `totalActs − pendingActs`. |
| `countComplete` | booleano | derivado | `countedActs = totalActs`, sin actas en JEE ni pendientes. |
| `outcome.kind` | enum | derivado (§5) | `SEGUNDA_VUELTA`, `PRIMER_LUGAR_VIRTUAL`, `EN_COMPUTO`, `PROCLAMADO`, `REPARTO_PROPORCIONAL`. |
| `sources.totals/candidates/blankNull` | URL | ONPE | Servicios consultados. |
| `sourceTimestamp` | fecha | `fechaActualizacion` | Corte ONPE de esa elección. |

### 3.4 `results[]` — modelo `ElectionResult` (una fila por candidatura)

| Campo | Tipo | Origen | Descripción |
|---|---|---|---|
| `electionId`, `electionName`, `level` | | ONPE / derivado | Tipo de elección. |
| `department` | `"Moquegua"` | — | |
| `province`, `district` | texto | ONPE (nombre con formato editorial) | Ámbito. |
| `candidateName` | texto | `nombreCandidato` | Mayúsculas como en ONPE. Vacío si ONPE no lo publica (listas del consejo regional y algunas candidaturas). |
| `candidateNameMissing` | booleano | derivado | `true` si `candidateName` está vacío. |
| `nameNormalizedFrom` | texto | ONPE | Nombre original cuando contenía el texto literal `null` (se omite al mostrar). |
| `organizationName` | texto | `nombreAgrupacionPolitica` | Nombre oficial en ONPE. |
| `organizationShortName` | texto | editorial (`organizaciones.csv`) | Sigla o nombre corto de presentación. |
| `organizationCode` | texto | `codigoAgrupacionPolitica` | Código ONPE de la organización. |
| `organizationLogo` | ruta | `logos-manifest.csv` | Archivo en `public/logos/partidos/`. |
| `votes` | entero | `totalVotosValidos` | Votos de la candidatura. |
| `validVotePct` | % | `porcentajeVotosValidos` | Votos ÷ válidos × 100 (se verifica). |
| `emittedVotePct` | % | `porcentajeVotosEmitidos` | Votos ÷ emitidos × 100. |
| `rank` | entero | derivado | Ranking de competencia (empates comparten puesto). |
| `validVotes`, `blankVotes`, `nullVotes`, `challengedVotes`, `votesCast`, `eligibleVoters` | entero | ver §3.3 | Totales de la elección repetidos por fila. |
| `totalActs`, `processedActs`, `countedActs`, `observedActs`, `jeeActs` | entero | ver §3.3 | `observedActs` = actas enviadas al JEE. |
| `status` | enum | derivado (§5) | `COMPUTO_ONPE`, `PRIMER_LUGAR_VIRTUAL`, `SEGUNDA_VUELTA`, `PROCLAMADO_JNE_JEE`. |
| `isLeading` | booleano | derivado | Encabeza el cómputo (puede ser parcial). |
| `statusNote`, `statusSourceUrl` | texto, URL | derivado / JNE | Explicación del estado y fuente de proclamación si existe. |
| `sourceUrl`, `sourceTimestamp` | URL, fecha | ONPE | Servicio y corte de la fila. |
| `snapshotHash` | SHA-256 | derivado | Hash del snapshot al que pertenece. |
| `unitId`, `ubigeo` | texto | derivado / ONPE | Elección y ámbito. |

### 3.5 `participation[]` — modelo `Participation`

| Campo | Origen (ONPE `participacion-ciudadana/totales`) | Descripción |
|---|---|---|
| `eligibleVoters` | `totalElectoresHabiles` | Electores hábiles. |
| `votersWhoVoted` | `totalAsistentes` | Ciudadanos que votaron (actas contabilizadas). |
| `absentees` | `totalAusentes` | Ausentes. **No incluye** votos en blanco, nulos ni impugnados. |
| `pendingVoters` | derivado: `hábiles − votaron − ausentes` | Electores de actas no contabilizadas (p. ej., en el JEE). No se cuentan como ausentes. |
| `turnoutPct` | derivado: `votaron ÷ hábiles × 100` | Se verifica contra `porcentajeAsistentes`. |
| `absenteePct` | derivado: `ausentes ÷ hábiles × 100` | Se verifica contra `porcentajeAusentes`. |
| `pendingPct` | derivado | `pendientes ÷ hábiles × 100`. |
| `provisional` | derivado | `true` si hay pendientes. |
| `onpeTurnoutPct`, `onpeAbsenteePct` | `porcentajeAsistentes`, `porcentajeAusentes` | Valores publicados. |
| `scope` | — | `REGION`, `PROVINCE`, `DISTRICT`. |
| `sourceTimestamp` | cabecera de la página ONPE | Corte de participación. |
| `basis` | — | Módulo de participación de ONPE, basado en actas de la elección municipal provincial. |

Fórmulas: `ausentes = hábiles − votaron` cuando `pendientes = 0`; en general `ausentes + pendientes = hábiles − votaron` y `participación + ausentismo + pendientes ≈ 100 %`.

### 3.6 `organizations[]`

| Campo | Origen | Descripción |
|---|---|---|
| `code`, `name` | ONPE | Código y nombre oficial. |
| `displayName`, `shortName` | editorial (`organizaciones.csv`) | Nombre con mayúsculas y tildes; sigla. |
| `slug` | derivado | Identificador de URL. |
| `logo.file`, `logo.sourceUrl`, `logo.sha256`, `logo.verified`, `logo.sourceKind` | `logos-manifest.csv` | Procedencia del símbolo. |

## 4. Manifiesto de snapshot

```json
{ "source": "ONPE", "fetchedAt": "…", "records": 164, "sha256": "<sha256 del archivo .json>",
  "validationPassed": true, "publishable": true, "snapshotId": "…", "snapshotHash": "<hash de contenido>",
  "rawFolder": "…", "captureMethods": ["…"], "sourceTimestampMin": "…", "sourceTimestampMax": "…", "buildIssues": [] }
```

## 5. Estados

| Estado | Regla |
|---|---|
| `COMPUTO_ONPE` | Valor por defecto: votos del cómputo ONPE. |
| `PRIMER_LUGAR_VIRTUAL` | Alcaldías: primer lugar único con actas al 100 %. Gobierno regional: primer lugar con ≥ 30 % de válidos y actas al 100 %. No es una proclamación. |
| `SEGUNDA_VUELTA` | Gobierno regional con actas al 100 % y ninguna fórmula con ≥ 30 % de válidos: las dos más votadas. |
| `PROCLAMADO_JNE_JEE` | Solo si `data/reference/proclamaciones-jne.csv` registra una resolución con URL de `jne.gob.pe`. |
| (interfaz) "Primer lugar parcial" | `COMPUTO_ONPE` + `isLeading` con conteo incompleto. |

## 6. Referencias (`data/reference`)

| Archivo | Columnas | Uso |
|---|---|---|
| `organizaciones.csv` | `code, onpe_name, display_name, short_name, note` | Nombres de presentación (no cambian la denominación oficial). |
| `logos-manifest.csv` | `organization_name, organization_code, filename, source_url, source_kind, downloaded_at, sha256, format, license_or_usage_note, verified` | Procedencia de cada símbolo. |
| `jne-simbolos.csv` (opcional) | `code, jne_id, checked_by, checked_at` | Mapeo manual a símbolos del JNE (prioridad 1). |
| `logos-oficiales.csv` (opcional) | `code, url, checked_at` | Logo del sitio oficial (prioridad 2). |
| `proclamaciones-jne.csv` | `election_id, ubigeo, organization_code, candidate_name, resolution, resolution_date, source_url, checked_at` | Proclamaciones verificadas (vacío en esta versión). |
| `reglas.json` | — | Umbral y fuente de la segunda vuelta regional. |
| `territorio-moquegua.json` | — | Distritos con alcaldía distrital según el selector de ONPE. |

## 7. Informe de validación

`reports/validation-report.json`: `passed`, `publishable` (sin fallos críticos), `summary` y `checks[]` con `id`, `title`, `severity` (`critical`/`warning`), `passed`, `checkedItems`, `failures[]`. Controles: 01 sourceUrl · 02 sourceTimestamp · 03 votos ≥ 0 · 04 porcentajes 0–100 · 05 ranking · 06 suma de candidaturas = válidos · 07 válidos + blancos + nulos (+ impugnados) = emitidos · 08 hábiles ≥ votaron · 09 ausentes = hábiles − votaron (con pendientes aparte) · 10 participación + ausentismo (+ pendientes) ≈ 100 % · 11 proclamado solo con fuente JNE/JEE · 12 totales cuadran entre niveles · recálculo de porcentajes · reglas de estado · duplicados · hash · cobertura territorial · (advertencias) desglose de blancos/nulos, porcentaje de participación ONPE, emitidos gobernador = suma del consejo.

## 8. CSV de datos abiertos

- `resultados.csv`: columnas de §3.4 en este orden: `electionId, electionName, level, department, province, district, ubigeo, unitId, candidateName, organizationCode, organizationName, organizationShortName, votes, validVotePct, emittedVotePct, rank, status, validVotes, blankVotes, nullVotes, challengedVotes, votesCast, eligibleVoters, totalActs, processedActs, countedActs, observedActs, jeeActs, sourceUrl, sourceTimestamp, snapshotHash`. Es también el formato de importación CSV (Modo B); `sourceUrl` y `sourceTimestamp` son obligatorios y los estados se recalculan.
- `participacion.csv`: `scope, ubigeo, department, province, district, eligibleVoters, votersWhoVoted, absentees, pendingVoters, turnoutPct, absenteePct, pendingPct, provisional, onpeTurnoutPct, onpeAbsenteePct, sourceUrl, sourceTimestamp`.
