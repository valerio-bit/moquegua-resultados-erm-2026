import { z } from "zod";

/** Tipos de elección documentados por ONPE para ERM 2026. */
export const ElectionIdSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);
export type ElectionId = z.infer<typeof ElectionIdSchema>;

export const LevelSchema = z.enum(["REGIONAL", "PROVINCIAL", "DISTRICT"]);
export type Level = z.infer<typeof LevelSchema>;

/**
 * Estado de una candidatura. Nunca significa "electo": solo PROCLAMADO_JNE_JEE
 * indica proclamación, y exige una fuente del JNE/JEE.
 */
export const StatusSchema = z.enum([
  "COMPUTO_ONPE",
  "PRIMER_LUGAR_VIRTUAL",
  "SEGUNDA_VUELTA",
  "PROCLAMADO_JNE_JEE",
]);
export type Status = z.infer<typeof StatusSchema>;

const nonNegInt = z.number().int().nonnegative();
const pct = z.number().min(0).max(100);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/, "hash SHA-256 en hexadecimal");
const isoDate = z.iso.datetime({ offset: true });
const ubigeo = z.string().regex(/^\d{6}$/);

/** Modelo mínimo pedido + campos de trazabilidad. Una fila por candidatura y ámbito. */
export const ElectionResultSchema = z.object({
  electionId: ElectionIdSchema,
  electionName: z.string().min(1),
  level: LevelSchema,
  department: z.literal("Moquegua"),
  province: z.string().optional(),
  district: z.string().optional(),

  candidateName: z.string(),
  organizationName: z.string().min(1),
  organizationShortName: z.string().optional(),
  organizationLogo: z.string().optional(),

  votes: nonNegInt,
  validVotePct: pct,
  rank: z.number().int().positive(),

  validVotes: nonNegInt.optional(),
  blankVotes: nonNegInt.optional(),
  nullVotes: nonNegInt.optional(),
  challengedVotes: nonNegInt.optional(),
  votesCast: nonNegInt.optional(),
  eligibleVoters: nonNegInt.optional(),

  totalActs: nonNegInt.optional(),
  processedActs: nonNegInt.optional(),
  countedActs: nonNegInt.optional(),
  observedActs: nonNegInt.optional(),
  jeeActs: nonNegInt.optional(),

  status: StatusSchema,

  sourceUrl: z.url(),
  sourceTimestamp: isoDate,
  snapshotHash: sha256,

  // Trazabilidad adicional
  unitId: z.string().min(1),
  ubigeo,
  organizationCode: z.string().min(1),
  emittedVotePct: pct.optional(),
  candidateNameMissing: z.boolean(),
  nameNormalizedFrom: z.string().optional(),
  isLeading: z.boolean(),
  statusNote: z.string().optional(),
  statusSourceUrl: z.url().optional(),
});
export type ElectionResult = z.infer<typeof ElectionResultSchema>;

export const OutcomeKindSchema = z.enum([
  "SEGUNDA_VUELTA",
  "PRIMER_LUGAR_VIRTUAL",
  "EN_COMPUTO",
  "PROCLAMADO",
  "REPARTO_PROPORCIONAL",
]);
export type OutcomeKind = z.infer<typeof OutcomeKindSchema>;

/** Totales de una elección en un ámbito (una circunscripción). */
export const ElectionUnitSchema = z.object({
  id: z.string().min(1),
  electionId: ElectionIdSchema,
  electionName: z.string(),
  level: LevelSchema,
  ubigeo,
  department: z.literal("Moquegua"),
  province: z.string().optional(),
  district: z.string().optional(),
  provinceUbigeo: ubigeo.optional(),
  validVotes: nonNegInt,
  blankVotes: nonNegInt.nullable(),
  nullVotes: nonNegInt.nullable(),
  challengedVotes: nonNegInt.nullable(),
  votesCast: nonNegInt,
  eligibleVoters: nonNegInt.nullable(),
  turnoutPct: pct.nullable(),
  totalActs: nonNegInt,
  countedActs: nonNegInt,
  countedActsPct: pct,
  jeeActs: nonNegInt,
  pendingActs: nonNegInt,
  processedActs: nonNegInt,
  countComplete: z.boolean(),
  outcome: z.object({
    kind: OutcomeKindSchema,
    organizationCodes: z.array(z.string()),
    note: z.string(),
    sourceUrl: z.url().optional(),
  }),
  sources: z.object({
    totals: z.url(),
    candidates: z.url(),
    blankNull: z.url().optional(),
  }),
  sourceTimestamp: isoDate,
  capturedAt: isoDate,
  captureMethod: z.string(),
});
export type ElectionUnit = z.infer<typeof ElectionUnitSchema>;

export const ParticipationSchema = z.object({
  eligibleVoters: nonNegInt,
  votersWhoVoted: nonNegInt,
  absentees: nonNegInt,
  turnoutPct: pct,
  absenteePct: pct,
  scope: z.enum(["REGION", "PROVINCE", "DISTRICT"]),
  department: z.string(),
  province: z.string().optional(),
  district: z.string().optional(),
  sourceTimestamp: isoDate,
  // Trazabilidad y casos provisionales
  ubigeo,
  pendingVoters: nonNegInt,
  pendingPct: pct,
  provisional: z.boolean(),
  onpeTurnoutPct: pct,
  onpeAbsenteePct: pct,
  sourceUrl: z.url(),
  basis: z.string(),
});
export type Participation = z.infer<typeof ParticipationSchema>;

export const OrganizationSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  displayName: z.string().min(1),
  shortName: z.string().optional(),
  slug: z.string().min(1),
  logo: z
    .object({
      file: z.string(),
      sourceUrl: z.url(),
      sha256,
      verified: z.boolean(),
      sourceKind: z.string(),
    })
    .optional(),
});
export type Organization = z.infer<typeof OrganizationSchema>;

export const DistrictRefSchema = z.object({
  ubigeo,
  name: z.string(),
  displayName: z.string(),
  slug: z.string(),
  hasDistrictElection: z.boolean(),
  isProvincialCapital: z.boolean(),
});
export const ProvinceRefSchema = z.object({
  ubigeo,
  name: z.string(),
  displayName: z.string(),
  slug: z.string(),
  districts: z.array(DistrictRefSchema),
});
export const TerritorySchema = z.object({
  department: z.object({ ubigeo, name: z.string(), displayName: z.string() }),
  provinces: z.array(ProvinceRefSchema),
  source: z.string(),
});
export type Territory = z.infer<typeof TerritorySchema>;
export type ProvinceRef = z.infer<typeof ProvinceRefSchema>;
export type DistrictRef = z.infer<typeof DistrictRefSchema>;

export const DatasetSchema = z.object({
  schemaVersion: z.literal(1),
  meta: z.object({
    source: z.literal("ONPE"),
    sourceName: z.string(),
    sourceHome: z.url(),
    processName: z.string(),
    processId: z.number(),
    electionDate: z.string(),
    department: z.literal("Moquegua"),
    departmentUbigeo: ubigeo,
    generatedAt: isoDate,
    snapshotId: z.string(),
    rawFolder: z.string(),
    captureMethods: z.array(z.string()),
    sourceTimestampMin: isoDate,
    sourceTimestampMax: isoDate,
    snapshotHash: sha256,
    secondRoundRule: z.object({
      thresholdPct: z.number(),
      electionDate: z.string(),
      sourceTitle: z.string(),
      sourceUrl: z.url(),
    }),
    notes: z.array(z.string()),
  }),
  territory: TerritorySchema,
  organizations: z.array(OrganizationSchema),
  elections: z.array(ElectionUnitSchema),
  results: z.array(ElectionResultSchema),
  participation: z.array(ParticipationSchema),
});
export type Dataset = z.infer<typeof DatasetSchema>;

/* ------------------------------------------------------------------ */
/* Respuestas de ONPE (presentacion-backend) tal como se capturan.     */
/* ------------------------------------------------------------------ */

const onpeEnvelope = <T extends z.ZodTypeAny>(data: T) =>
  z.object({ data, message: z.string().optional(), success: z.boolean() });

export const OnpeTotalesSchema = onpeEnvelope(
  z.object({
    actasContabilizadas: z.number(),
    contabilizadas: nonNegInt,
    totalActas: nonNegInt,
    participacionCiudadana: z.number().nullable(),
    actasEnviadasJee: z.number(),
    enviadasJee: nonNegInt,
    actasPendientesJee: z.number(),
    pendientesJee: nonNegInt,
    fechaActualizacion: isoDate,
    idUbigeoDepartamento: z.number().nullable(),
    idUbigeoProvincia: z.number().nullable(),
    idUbigeoDistrito: z.number().nullable(),
    totalVotosEmitidos: nonNegInt,
    totalVotosValidos: nonNegInt,
  }),
);

export const OnpeParticipanteSchema = z.object({
  nombreAgrupacionPolitica: z.string(),
  codigoAgrupacionPolitica: z.union([z.number(), z.string()]),
  nombreCandidato: z.string().nullable(),
  totalVotosValidos: nonNegInt,
  porcentajeVotosValidos: z.number().optional(),
  porcentajeVotosEmitidos: z.number(),
});
export const OnpeParticipantesSchema = onpeEnvelope(z.array(OnpeParticipanteSchema));

export const OnpeParticipacionTotalesSchema = onpeEnvelope(
  z.object({
    totalElectoresHabiles: nonNegInt,
    totalAsistentes: nonNegInt,
    totalAusentes: nonNegInt,
    porcentajeAsistentes: z.number(),
    porcentajeAusentes: z.number(),
  }),
);

export const CaptureKindSchema = z.enum([
  "totales",
  "participantes",
  "ubicacion-geografica",
  "mapa-calor-actas",
  "mesas",
  "participacion-totales",
  "participacion-hijos",
  "participacion-mapa-calor",
]);

export const CaptureSchema = z.object({
  kind: CaptureKindSchema.optional(),
  electionId: ElectionIdSchema.optional(),
  scope: z
    .object({ department: z.string(), province: z.string().optional(), district: z.string().optional() })
    .optional(),
  sourceUrl: z.url(),
  response: z.unknown(),
  note: z.string().optional(),
  reconstruction: z.string().optional(),
});
export type Capture = z.infer<typeof CaptureSchema>;

export const CaptureFileSchema = z.object({
  captureMethod: z.enum(["manual-browser-capture", "onpe-api", "manual-import"]),
  capturedAt: isoDate,
  pageTimestamp: isoDate.optional(),
  pageNote: z.string().optional(),
  captures: z.array(CaptureSchema).min(1),
});
export type CaptureFile = z.infer<typeof CaptureFileSchema>;
