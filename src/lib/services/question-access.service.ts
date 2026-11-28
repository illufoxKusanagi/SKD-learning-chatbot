import { and, eq, inArray, sql } from 'drizzle-orm';
import { db, questionAccessLogs } from '@/lib/db';

export interface QuestionCandidateBase {
  id: string;
  category: string;
  subtopic?: string | null;
}

export interface QuestionAccessEntry {
  questionId: string;
  isAccessed: boolean;
  accessCount: number;
  lastAccessedAt: Date;
}

export interface ActorIdentity {
  userId?: string | null;
  guestSessionId?: string | null;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SKD_CATEGORIES = ['TWK', 'TIU', 'TKP'] as const;

function resolveValidUserId(userId?: string | null): string | null {
  const trimmed = userId?.trim();
  return trimmed && UUID_REGEX.test(trimmed) ? trimmed : null;
}

export function buildActorKey(actor: ActorIdentity): string | null {
  const validUserId = resolveValidUserId(actor.userId);
  if (validUserId) return `user:${validUserId}`;
  const trimmedGuest = actor.guestSessionId?.trim();
  return trimmedGuest ? `guest:${trimmedGuest}` : null;
}
function shuffleInPlace<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function groupByKey<T, K>(items: readonly T[], getKey: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const key = getKey(item);
    const group = map.get(key);
    if (group) group.push(item);
    else map.set(key, [item]);
  }
  return map;
}

function orderBySubtopicRoundRobin<T extends QuestionCandidateBase>(items: readonly T[]): T[] {
  if (items.length <= 1) return [...items];
  const groups = groupByKey(items, (item) => item.subtopic?.trim() || 'Umum');
  const queues = shuffleInPlace(Array.from(groups.values(), (g) => shuffleInPlace(g)));
  const result: T[] = [];
  for (let round = 0; result.length < items.length; round += 1) {
    for (const queue of queues) {
      if (round < queue.length) result.push(queue[round]);
    }
  }
  return result;
}

export function selectQuestionsWithCycleReset<T extends QuestionCandidateBase>(
  candidates: readonly T[],
  needed: number,
  accessMap: ReadonlyMap<string, QuestionAccessEntry>
): { selected: T[]; didResetCycle: boolean; resetPoolQuestionIds: string[] } {
  const seenIds = new Set<string>();
  const uniqueCandidates = candidates.filter((item) => {
    if (seenIds.has(item.id)) return false;
    seenIds.add(item.id);
    return true;
  });

  if (needed <= 0 || uniqueCandidates.length === 0) {
    return { selected: [], didResetCycle: false, resetPoolQuestionIds: [] };
  }

  const target = Math.min(needed, uniqueCandidates.length);
  const unaccessed: T[] = [];
  const accessedInCycle: T[] = [];
  for (const item of uniqueCandidates) {
    if (!accessMap.get(item.id)?.isAccessed) unaccessed.push(item);
    else accessedInCycle.push(item);
  }

  const orderedUnaccessed = orderBySubtopicRoundRobin(unaccessed);
  if (orderedUnaccessed.length >= target) {
    return { selected: orderedUnaccessed.slice(0, target), didResetCycle: false, resetPoolQuestionIds: [] };
  }

  const selected: T[] = [...orderedUnaccessed];
  const selectedIds = new Set<string>(selected.map((item) => item.id));
  const bucketsByCount = groupByKey(accessedInCycle, (item) => accessMap.get(item.id)?.accessCount ?? 1);

  for (const count of Array.from(bucketsByCount.keys()).sort((a, b) => a - b)) {
    if (selected.length >= target) break;
    const byTs = groupByKey(
      bucketsByCount.get(count) ?? [],
      (item) => accessMap.get(item.id)?.lastAccessedAt.getTime() ?? 0
    );
    for (const ts of Array.from(byTs.keys()).sort((a, b) => a - b)) {
      for (const item of orderBySubtopicRoundRobin(byTs.get(ts) ?? [])) {
        if (selected.length >= target) break;
        if (!selectedIds.has(item.id)) {
          selected.push(item);
          selectedIds.add(item.id);
        }
      }
    }
  }

  const resetPoolQuestionIds = accessedInCycle.filter((item) => !selectedIds.has(item.id)).map((item) => item.id);
  return { selected, didResetCycle: true, resetPoolQuestionIds };
}

async function fetchAccessMap(
  actorKey: string
): Promise<Map<string, QuestionAccessEntry>> {
  const rows = await db
    .select({
      questionId: questionAccessLogs.questionId,
      isAccessed: questionAccessLogs.isAccessed,
      accessCount: questionAccessLogs.accessCount,
      lastAccessedAt: questionAccessLogs.lastAccessedAt,
    })
    .from(questionAccessLogs)
    .where(eq(questionAccessLogs.actorKey, actorKey));
  return new Map(rows.map((row) => [row.questionId, row]));
}

async function persistAccessSelection<T extends QuestionCandidateBase>(
  actor: ActorIdentity,
  actorKey: string,
  allSelected: readonly T[],
  allResetIds: readonly string[]
): Promise<void> {
  const uniqueResetIds = Array.from(new Set(allResetIds));
  if (uniqueResetIds.length === 0 && allSelected.length === 0) return;

  await db.transaction(async (tx) => {
    if (uniqueResetIds.length > 0) {
      await tx
        .update(questionAccessLogs)
        .set({ isAccessed: false })
        .where(and(eq(questionAccessLogs.actorKey, actorKey), inArray(questionAccessLogs.questionId, uniqueResetIds)));
    }
    if (allSelected.length > 0) {
      const now = new Date();
      const resolvedUserId = resolveValidUserId(actor.userId);
      const resolvedGuestId = resolvedUserId ? null : actor.guestSessionId?.trim() || null;
      await tx
        .insert(questionAccessLogs)
        .values(
          allSelected.map((item) => ({
            actorKey,
            userId: resolvedUserId,
            guestSessionId: resolvedGuestId,
            questionId: item.id,
            category: ['TWK', 'TIU', 'TKP'].includes(item.category.toUpperCase()) ? item.category.toUpperCase() : 'TWK',
            isAccessed: true,
            accessCount: 1,
            lastAccessedAt: now,
            createdAt: now,
          }))
        )
        .onConflictDoUpdate({
          target: [questionAccessLogs.actorKey, questionAccessLogs.questionId],
          set: { isAccessed: true, accessCount: sql`${questionAccessLogs.accessCount} + 1`, lastAccessedAt: now },
        });
    }
  });
}

export async function pickAndRecordFromPool<T extends QuestionCandidateBase>(params: {
  actor: ActorIdentity;
  candidates: readonly T[];
  needed: number;
}): Promise<T[]> {
  if (params.candidates.length === 0 || params.needed <= 0) return [];
  const actorKey = buildActorKey(params.actor);
  const accessMap = actorKey ? await fetchAccessMap(actorKey) : new Map<string, QuestionAccessEntry>();
  const { selected, resetPoolQuestionIds } = selectQuestionsWithCycleReset(params.candidates, params.needed, accessMap);
  if (actorKey) await persistAccessSelection(params.actor, actorKey, selected, resetPoolQuestionIds);
  return selected;
}

export async function pickAndRecordByCategories<T extends QuestionCandidateBase>(params: {
  actor: ActorIdentity;
  candidates: readonly T[];
  countsByCategory: { TWK: number; TIU: number; TKP: number };
}): Promise<T[]> {
  const { TWK, TIU, TKP } = params.countsByCategory;
  if (params.candidates.length === 0 || Math.max(0, TWK) + Math.max(0, TIU) + Math.max(0, TKP) <= 0) return [];
  const actorKey = buildActorKey(params.actor);
  const accessMap = actorKey ? await fetchAccessMap(actorKey) : new Map<string, QuestionAccessEntry>();
  const allSelected: T[] = [];
  const allResetIds: string[] = [];

  for (const cat of SKD_CATEGORIES) {
    const needed = params.countsByCategory[cat];
    if (needed <= 0) continue;
    const catCandidates = params.candidates.filter((item) => item.category.toUpperCase() === cat);
    const { selected, resetPoolQuestionIds } = selectQuestionsWithCycleReset(catCandidates, needed, accessMap);
    allSelected.push(...selected);
    allResetIds.push(...resetPoolQuestionIds);
  }

  if (actorKey) await persistAccessSelection(params.actor, actorKey, allSelected, allResetIds);
  return allSelected;
}
