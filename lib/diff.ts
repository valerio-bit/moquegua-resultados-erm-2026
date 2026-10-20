import type { Dataset, ElectionResult, ElectionUnit } from "@/lib/schemas";

export interface RecordChange {
  key: string;
  unitId: string;
  label: string;
  before?: Pick<ElectionResult, "votes" | "validVotePct" | "rank" | "status" | "candidateName">;
  after?: Pick<ElectionResult, "votes" | "validVotePct" | "rank" | "status" | "candidateName">;
  votesDelta: number;
  pctDelta: number;
  statusChanged: boolean;
}

export interface UnitChange {
  unitId: string;
  label: string;
  countedActsPctBefore: number | null;
  countedActsPctAfter: number | null;
  leaderBefore: string[];
  leaderAfter: string[];
  leaderChanged: boolean;
  outcomeBefore: string | null;
  outcomeAfter: string | null;
  outcomeChanged: boolean;
  sourceTimestampBefore: string | null;
  sourceTimestampAfter: string | null;
}

export interface DiffReport {
  before: { snapshotId: string; snapshotHash: string; generatedAt: string; sourceTimestampMax: string };
  after: { snapshotId: string; snapshotHash: string; generatedAt: string; sourceTimestampMax: string };
  identical: boolean;
  counts: { added: number; removed: number; modified: number; votesChanged: number; pctChanged: number; statusChanged: number };
  added: RecordChange[];
  removed: RecordChange[];
  modified: RecordChange[];
  units: UnitChange[];
  participationChanged: { ubigeo: string; field: string; before: number; after: number }[];
}

const pick = (r: ElectionResult) => ({
  votes: r.votes,
  validVotePct: r.validVotePct,
  rank: r.rank,
  status: r.status,
  candidateName: r.candidateName,
});

const keyOf = (r: ElectionResult) => `${r.unitId}/${r.organizationCode}`;

function unitLabel(u: Pick<ElectionUnit, "electionName" | "province" | "district">): string {
  return [u.electionName, u.province, u.district].filter(Boolean).join(" · ");
}

/** Compara dos versiones del dataset: registros añadidos, eliminados y modificados, y cambios por elección. */
export function compareDatasets(prev: Dataset, next: Dataset): DiffReport {
  const before = new Map(prev.results.map((r) => [keyOf(r), r]));
  const after = new Map(next.results.map((r) => [keyOf(r), r]));
  const unitsBefore = new Map(prev.elections.map((u) => [u.id, u]));
  const unitsAfter = new Map(next.elections.map((u) => [u.id, u]));
  const label = (r: ElectionResult) => {
    const u = unitsAfter.get(r.unitId) ?? unitsBefore.get(r.unitId);
    return `${u ? unitLabel(u) : r.unitId} — ${r.organizationName}`;
  };

  const added: RecordChange[] = [];
  const removed: RecordChange[] = [];
  const modified: RecordChange[] = [];
  for (const [k, r] of after) {
    const old = before.get(k);
    if (!old) {
      added.push({ key: k, unitId: r.unitId, label: label(r), after: pick(r), votesDelta: r.votes, pctDelta: r.validVotePct, statusChanged: false });
      continue;
    }
    const votesDelta = r.votes - old.votes;
    const pctDelta = Math.round((r.validVotePct - old.validVotePct) * 1000) / 1000;
    const statusChanged = r.status !== old.status;
    if (votesDelta !== 0 || pctDelta !== 0 || statusChanged || r.rank !== old.rank || r.candidateName !== old.candidateName) {
      modified.push({ key: k, unitId: r.unitId, label: label(r), before: pick(old), after: pick(r), votesDelta, pctDelta, statusChanged });
    }
  }
  for (const [k, r] of before) {
    if (!after.has(k)) {
      removed.push({ key: k, unitId: r.unitId, label: label(r), before: pick(r), votesDelta: -r.votes, pctDelta: -r.validVotePct, statusChanged: false });
    }
  }

  const units: UnitChange[] = [];
  for (const id of new Set([...unitsBefore.keys(), ...unitsAfter.keys()])) {
    const a = unitsBefore.get(id);
    const b = unitsAfter.get(id);
    const leaderBefore = a?.outcome.organizationCodes ?? [];
    const leaderAfter = b?.outcome.organizationCodes ?? [];
    const leaderChanged = leaderBefore.join(",") !== leaderAfter.join(",");
    const outcomeChanged = (a?.outcome.kind ?? null) !== (b?.outcome.kind ?? null);
    const actsChanged = (a?.countedActsPct ?? null) !== (b?.countedActsPct ?? null);
    const stampChanged = (a?.sourceTimestamp ?? null) !== (b?.sourceTimestamp ?? null);
    if (leaderChanged || outcomeChanged || actsChanged || stampChanged) {
      units.push({
        unitId: id,
        label: unitLabel((b ?? a)!),
        countedActsPctBefore: a?.countedActsPct ?? null,
        countedActsPctAfter: b?.countedActsPct ?? null,
        leaderBefore,
        leaderAfter,
        leaderChanged,
        outcomeBefore: a?.outcome.kind ?? null,
        outcomeAfter: b?.outcome.kind ?? null,
        outcomeChanged,
        sourceTimestampBefore: a?.sourceTimestamp ?? null,
        sourceTimestampAfter: b?.sourceTimestamp ?? null,
      });
    }
  }

  const participationChanged: DiffReport["participationChanged"] = [];
  const pBefore = new Map(prev.participation.map((p) => [p.ubigeo, p]));
  for (const p of next.participation) {
    const old = pBefore.get(p.ubigeo);
    if (!old) continue;
    for (const field of ["eligibleVoters", "votersWhoVoted", "absentees", "pendingVoters"] as const) {
      if (old[field] !== p[field]) participationChanged.push({ ubigeo: p.ubigeo, field, before: old[field], after: p[field] });
    }
  }

  const meta = (d: Dataset) => ({
    snapshotId: d.meta.snapshotId,
    snapshotHash: d.meta.snapshotHash,
    generatedAt: d.meta.generatedAt,
    sourceTimestampMax: d.meta.sourceTimestampMax,
  });
  return {
    before: meta(prev),
    after: meta(next),
    identical: prev.meta.snapshotHash === next.meta.snapshotHash,
    counts: {
      added: added.length,
      removed: removed.length,
      modified: modified.length,
      votesChanged: modified.filter((m) => m.votesDelta !== 0).length,
      pctChanged: modified.filter((m) => m.pctDelta !== 0).length,
      statusChanged: modified.filter((m) => m.statusChanged).length,
    },
    added,
    removed,
    modified,
    units,
    participationChanged,
  };
}
