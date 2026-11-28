import { describe, expect, it } from 'vitest';
import {
  buildActorKey,
  selectQuestionsWithCycleReset,
  type QuestionAccessEntry,
  type QuestionCandidateBase,
} from '@/lib/services/question-access.service';

interface TestCandidate extends QuestionCandidateBase {
  id: string;
  category: 'TWK' | 'TIU' | 'TKP';
  subtopic: string;
}

function makeCandidates(
  count: number,
  category: 'TWK' | 'TIU' | 'TKP' = 'TWK'
): TestCandidate[] {
  const subtopics = ['Pancasila', 'UUD 1945', 'Bhinneka Tunggal Ika', 'NKRI'];
  return Array.from({ length: count }, (_, idx) => ({
    id: `q-${idx + 1}`,
    category,
    subtopic: subtopics[idx % subtopics.length],
  }));
}

describe('question-access cycle logic', () => {
  it('buildActorKey prefers valid userId, falls back to guestSessionId, and returns null if both empty', () => {
    const validUuid = '123e4567-e89b-12d3-a456-426614174000';
    expect(
      buildActorKey({ userId: `  ${validUuid}  `, guestSessionId: 'guest-abc' })
    ).toBe(`user:${validUuid}`);

    expect(
      buildActorKey({ userId: 'not-a-uuid', guestSessionId: '  guest-abc  ' })
    ).toBe('guest:guest-abc');

    expect(buildActorKey({ userId: null, guestSessionId: 'guest-only' })).toBe(
      'guest:guest-only'
    );

    expect(buildActorKey({ userId: '', guestSessionId: '   ' })).toBeNull();
    expect(buildActorKey({})).toBeNull();
  });

  it('skips items with isAccessed: true within an active cycle and sets didResetCycle: false', () => {
    const candidates = makeCandidates(8);
    const now = new Date('2026-01-01T00:00:00Z');
    const accessMap = new Map<string, QuestionAccessEntry>([
      ['q-1', { questionId: 'q-1', isAccessed: true, accessCount: 1, lastAccessedAt: now }],
      ['q-2', { questionId: 'q-2', isAccessed: true, accessCount: 1, lastAccessedAt: now }],
      ['q-3', { questionId: 'q-3', isAccessed: true, accessCount: 2, lastAccessedAt: now }],
      ['q-4', { questionId: 'q-4', isAccessed: false, accessCount: 1, lastAccessedAt: now }],
    ]);

    const result = selectQuestionsWithCycleReset(candidates, 4, accessMap);

    expect(result.didResetCycle).toBe(false);
    expect(result.resetPoolQuestionIds).toEqual([]);
    expect(result.selected).toHaveLength(4);

    const selectedIds = new Set(result.selected.map((q) => q.id));
    expect(selectedIds.has('q-1')).toBe(false);
    expect(selectedIds.has('q-2')).toBe(false);
    expect(selectedIds.has('q-3')).toBe(false);
    expect(selectedIds.size).toBe(4);
  });

  it('wraps around cycle when unaccessed < needed, prioritizing lowest accessCount with no duplicates', () => {
    const candidates = makeCandidates(10);
    const t1 = new Date('2026-01-01T00:00:00Z');
    const t2 = new Date('2026-01-02T00:00:00Z');
    // 3 unaccessed (q-8, q-9, q-10), 7 accessed (q-1..q-3 have accessCount 1, q-4..q-7 have accessCount 2)
    const accessMap = new Map<string, QuestionAccessEntry>([
      ['q-1', { questionId: 'q-1', isAccessed: true, accessCount: 1, lastAccessedAt: t1 }],
      ['q-2', { questionId: 'q-2', isAccessed: true, accessCount: 1, lastAccessedAt: t1 }],
      ['q-3', { questionId: 'q-3', isAccessed: true, accessCount: 1, lastAccessedAt: t1 }],
      ['q-4', { questionId: 'q-4', isAccessed: true, accessCount: 2, lastAccessedAt: t2 }],
      ['q-5', { questionId: 'q-5', isAccessed: true, accessCount: 2, lastAccessedAt: t2 }],
      ['q-6', { questionId: 'q-6', isAccessed: true, accessCount: 2, lastAccessedAt: t2 }],
      ['q-7', { questionId: 'q-7', isAccessed: true, accessCount: 2, lastAccessedAt: t2 }],
    ]);

    const result = selectQuestionsWithCycleReset(candidates, 6, accessMap);

    expect(result.didResetCycle).toBe(true);
    expect(result.selected).toHaveLength(6);

    const selectedIds = result.selected.map((q) => q.id);
    expect(new Set(selectedIds).size).toBe(6);

    // First 3 must be all remaining unaccessed questions
    expect(new Set(selectedIds.slice(0, 3))).toEqual(
      new Set(['q-8', 'q-9', 'q-10'])
    );
    // Next 3 must be the lowest accessCount items (q-1, q-2, q-3)
    expect(new Set(selectedIds.slice(3, 6))).toEqual(
      new Set(['q-1', 'q-2', 'q-3'])
    );
    // Remaining 4 accessed items not selected must be marked for reset
    expect(new Set(result.resetPoolQuestionIds)).toEqual(
      new Set(['q-4', 'q-5', 'q-6', 'q-7'])
    );
  });

  it('simulates 65-question pool across 7 requests of 10 with full coverage and cycle reset', () => {
    const candidates = makeCandidates(65, 'TWK');
    const accessMap = new Map<string, QuestionAccessEntry>();
    const allServedIds = new Set<string>();

    const applyDbUpdate = (
      selected: readonly TestCandidate[],
      resetPoolQuestionIds: readonly string[],
      timestamp: Date
    ) => {
      for (const id of resetPoolQuestionIds) {
        const existing = accessMap.get(id);
        if (existing) {
          accessMap.set(id, { ...existing, isAccessed: false });
        }
      }
      for (const item of selected) {
        const existing = accessMap.get(item.id);
        accessMap.set(item.id, {
          questionId: item.id,
          isAccessed: true,
          accessCount: (existing?.accessCount ?? 0) + 1,
          lastAccessedAt: timestamp,
        });
        allServedIds.add(item.id);
      }
    };

    // Requests 1..6 (60 questions total, no cycle reset yet)
    for (let req = 1; req <= 6; req += 1) {
      const res = selectQuestionsWithCycleReset(candidates, 10, accessMap);
      expect(res.didResetCycle).toBe(false);
      expect(res.resetPoolQuestionIds).toEqual([]);
      expect(res.selected).toHaveLength(10);
      applyDbUpdate(
        res.selected,
        res.resetPoolQuestionIds,
        new Date(`2026-01-0${req}T00:00:00Z`)
      );
    }

    expect(allServedIds.size).toBe(60);
    for (const id of allServedIds) {
      expect(accessMap.get(id)?.accessCount).toBe(1);
      expect(accessMap.get(id)?.isAccessed).toBe(true);
    }

    const remainingUnaccessedBeforeReq7 = candidates
      .filter((c) => !accessMap.get(c.id)?.isAccessed)
      .map((c) => c.id);
    expect(remainingUnaccessedBeforeReq7).toHaveLength(5);

    // Request 7 (asks for 10 when 5 remain unaccessed -> triggers cycle reset)
    const res7 = selectQuestionsWithCycleReset(candidates, 10, accessMap);
    expect(res7.didResetCycle).toBe(true);
    expect(res7.selected).toHaveLength(10);

    const req7Ids = new Set(res7.selected.map((q) => q.id));
    expect(req7Ids.size).toBe(10);

    for (const unaccessedId of remainingUnaccessedBeforeReq7) {
      expect(req7Ids.has(unaccessedId)).toBe(true);
    }

    expect(res7.resetPoolQuestionIds).toHaveLength(55);
    applyDbUpdate(
      res7.selected,
      res7.resetPoolQuestionIds,
      new Date('2026-01-07T00:00:00Z')
    );

    // All 65 distinct questions have now been served at least once
    expect(allServedIds.size).toBe(65);

    // 55 reset items are now isAccessed: false ready for cycle 2; 10 selected in req 7 are isAccessed: true
    const unaccessedForCycle2 = candidates.filter(
      (c) => accessMap.get(c.id)?.isAccessed === false
    );
    const accessedInCycle2 = candidates.filter(
      (c) => accessMap.get(c.id)?.isAccessed === true
    );
    expect(unaccessedForCycle2).toHaveLength(55);
    expect(accessedInCycle2).toHaveLength(10);
  });
});
