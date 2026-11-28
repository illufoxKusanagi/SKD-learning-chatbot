import { afterAll, describe, expect, it, vi } from "vitest";

vi.hoisted(async () => {
  const dotenv = await import("dotenv");
  dotenv.config({ path: ".env.local" });
  dotenv.config({ path: ".env" });
});

vi.mock("@/lib/services/ai/embeddings.service", () => ({
  generateEmbedding: vi.fn(() => {
    throw new Error("generateEmbedding MUST NOT be called in Practice Pack");
  }),
}));

import { and, eq, inArray, notInArray } from "drizzle-orm";
import { NextRequest } from "next/server";
import {
  closeConnection,
  db,
  quizAttempts,
  quizQuestions,
  quizSessions,
} from "@/lib/db";
import {
  createPracticePack,
  syncPracticeAttempt,
} from "@/lib/services/practice.service";
import { POST as postPracticePack } from "@/app/api/practice/pack/route";
import { POST as postPracticeSync } from "@/app/api/practice/sync/route";
import { GET as getQuizHistory } from "@/app/api/quiz/route";

describe("Practice Pack Pre-Fetch & Background Sync API", () => {
  const createdSessionIds: string[] = [];

  afterAll(async () => {
    if (createdSessionIds.length > 0) {
      await db
        .delete(quizSessions)
        .where(inArray(quizSessions.id, createdSessionIds));
    }
    await closeConnection();
  });

  it("createPracticePack({ count: 10, category: 'TWK' }) creates a quiz_sessions row and returns 10 masked TWK questions with preloaded materials", async () => {
    const pack = await createPracticePack({ count: 10, category: "TWK" });
    expect(pack.sessionId).toBeTruthy();
    createdSessionIds.push(pack.sessionId);

    expect(pack.mode).toBe("practice");
    expect(pack.totalCount).toBe(10);
    expect(pack.questions).toHaveLength(10);

    const [sessionRow] = await db
      .select()
      .from(quizSessions)
      .where(eq(quizSessions.id, pack.sessionId));

    expect(sessionRow).toBeDefined();
    expect(sessionRow.mode).toBe("practice");
    expect(sessionRow.status).toBe("in_progress");
    expect(sessionRow.questionOrder).toHaveLength(10);

    for (const q of pack.questions) {
      expect(q.category).toBe("TWK");
      expect("correctOption" in q).toBe(false);
      expect("scoringRubric" in q).toBe(false);
      expect("optionRationales" in q).toBe(false);
      expect("reasoningChain" in q).toBe(false);
      expect(q.hint).toBeTruthy();
      expect(q.materials.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("createPracticePack({ count: 10, category: 'TKP' }) masks rubric before answering and reveals scoringRubric 1..5 on syncPracticeAttempt", async () => {
    const pack = await createPracticePack({ count: 10, category: "TKP" });
    expect(pack.sessionId).toBeTruthy();
    createdSessionIds.push(pack.sessionId);

    expect(pack.mode).toBe("practice");
    expect(pack.totalCount).toBe(10);
    expect(pack.questions).toHaveLength(10);

    for (const q of pack.questions) {
      expect(q.category).toBe("TKP");
      expect("correctOption" in q).toBe(false);
      expect("scoringRubric" in q).toBe(false);
      expect("optionRationales" in q).toBe(false);
      expect("reasoningChain" in q).toBe(false);
      expect(q.materials).toEqual([]);
    }

    const revealed = await syncPracticeAttempt({
      sessionId: pack.sessionId,
      questionId: pack.questions[0].id,
      selectedOption: "A",
    });
    expect(revealed.correctOption).toBeNull();
    expect(revealed.scoringRubric).not.toBeNull();
    const scores = Object.values(revealed.scoringRubric!).sort((a, b) => a - b);
    expect(scores).toEqual([1, 2, 3, 4, 5]);
    expect(revealed.optionRationales.A).toBeTruthy();
    expect(revealed.optionRationales.E).toBeTruthy();
    expect(revealed.reasoningChain).toBeTruthy();
    expect(revealed.isCorrect).toBe(revealed.scoreEarned === 5);
  });

  it("createPracticePack({ materialSlug: 'twk-uud45-checks-balances-presiden-dpr', count: 10 }) returns only questions linked to that material", async () => {
    const targetSlug = "twk-uud45-checks-balances-presiden-dpr";
    const pack = await createPracticePack({
      materialSlug: targetSlug,
      count: 10,
    });
    expect(pack.sessionId).toBeTruthy();
    createdSessionIds.push(pack.sessionId);

    expect(pack.totalCount).toBeGreaterThanOrEqual(1);
    expect(pack.totalCount).toBeLessThanOrEqual(10);
    for (const q of pack.questions) {
      expect(q.category).toBe("TWK");
      expect(q.materials.some((m) => m.slug === targetSlug)).toBe(true);
    }
  });

  it("enforces idempotent (session_id, question_id) upsert on rapid sequential and concurrent syncPracticeAttempt calls", async () => {
    const pack = await createPracticePack({ count: 10, category: "TWK" });
    createdSessionIds.push(pack.sessionId);

    const targetQ1 = pack.questions[0];
    const [dbQ1] = await db
      .select({ correctOption: quizQuestions.correctOption })
      .from(quizQuestions)
      .where(eq(quizQuestions.id, targetQ1.id))
      .limit(1);
    const rightOption = dbQ1.correctOption as "A" | "B" | "C" | "D" | "E";
    const wrongOption = (["A", "B", "C", "D", "E"] as const).find(
      (opt) => opt !== rightOption
    )!;

    const first = await syncPracticeAttempt({
      sessionId: pack.sessionId,
      questionId: targetQ1.id,
      selectedOption: wrongOption,
      usedHint: false,
      timeSpentSeconds: 12,
    });
    expect(first.scoreEarned).toBe(0);
    expect(first.isCorrect).toBe(false);
    expect(first.correctOption).toBe(rightOption);

    const second = await syncPracticeAttempt({
      sessionId: pack.sessionId,
      questionId: targetQ1.id,
      selectedOption: rightOption,
      usedHint: true,
      timeSpentSeconds: 20,
    });
    expect(second.attemptId).toBe(first.attemptId);
    expect(second.scoreEarned).toBe(5);
    expect(second.isCorrect).toBe(true);
    expect(second.reasoningChain).toBeTruthy();
    expect(second.optionRationales.A).toBeTruthy();

    const rowsQ1 = await db
      .select()
      .from(quizAttempts)
      .where(
        and(
          eq(quizAttempts.sessionId, pack.sessionId),
          eq(quizAttempts.questionId, targetQ1.id)
        )
      );
    expect(rowsQ1).toHaveLength(1);
    expect(rowsQ1[0].userAnswer).toBe(rightOption);
    expect(rowsQ1[0].scoreEarned).toBe(5);
    expect(rowsQ1[0].usedHint).toBe(true);

    // Retry with usedHint: false must preserve prior usedHint: true
    await syncPracticeAttempt({
      sessionId: pack.sessionId,
      questionId: targetQ1.id,
      selectedOption: rightOption,
      usedHint: false,
      timeSpentSeconds: 22,
    });
    const [preservedHintRow] = await db
      .select()
      .from(quizAttempts)
      .where(
        and(
          eq(quizAttempts.sessionId, pack.sessionId),
          eq(quizAttempts.questionId, targetQ1.id)
        )
      );
    expect(preservedHintRow.usedHint).toBe(true);

    // Concurrent calls on the same (sessionId, questionId)
    const targetQ2 = pack.questions[1];
    await Promise.all([
      syncPracticeAttempt({
        sessionId: pack.sessionId,
        questionId: targetQ2.id,
        selectedOption: "A",
        usedHint: false,
      }),
      syncPracticeAttempt({
        sessionId: pack.sessionId,
        questionId: targetQ2.id,
        selectedOption: "B",
        usedHint: true,
      }),
    ]);

    const rowsQ2 = await db
      .select()
      .from(quizAttempts)
      .where(
        and(
          eq(quizAttempts.sessionId, pack.sessionId),
          eq(quizAttempts.questionId, targetQ2.id)
        )
      );
    expect(rowsQ2).toHaveLength(1);
  });

  it("wrongOnly: true returns only missed questions for the guest session and exposes standalone attempts in GET /api/quiz", async () => {
    const pack = await createPracticePack({ count: 10, category: "TWK" });
    createdSessionIds.push(pack.sessionId);

    const missedQ = pack.questions[0];
    const optimalQ = pack.questions[1];
    const keyRows = await db
      .select({
        id: quizQuestions.id,
        correctOption: quizQuestions.correctOption,
      })
      .from(quizQuestions)
      .where(inArray(quizQuestions.id, [missedQ.id, optimalQ.id]));
    const keyById = new Map(keyRows.map((r) => [r.id, r.correctOption!]));

    const wrongOption = (["A", "B", "C", "D", "E"] as const).find(
      (opt) => opt !== keyById.get(missedQ.id)
    )!;

    await syncPracticeAttempt({
      sessionId: pack.sessionId,
      questionId: missedQ.id,
      selectedOption: wrongOption,
    });
    await syncPracticeAttempt({
      sessionId: pack.sessionId,
      questionId: optimalQ.id,
      selectedOption: keyById.get(optimalQ.id) as "A" | "B" | "C" | "D" | "E",
    });

    const retryPack = await createPracticePack({
      wrongOnly: true,
      guestSessionIds: [pack.sessionId],
    });
    expect(retryPack.sessionId).toBeTruthy();
    createdSessionIds.push(retryPack.sessionId);

    expect(retryPack.totalCount).toBe(1);
    expect(retryPack.questions).toHaveLength(1);
    expect(retryPack.questions[0].id).toBe(missedQ.id);

    // Verify GET /api/quiz?sessionIds=... returns standalone chatId=null attempts
    const req = new NextRequest(
      `http://localhost/api/quiz?sessionIds=${pack.sessionId}`
    );
    const res = await getQuizHistory(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.quizzes.length).toBe(2);
    expect(body.data.stats.answeredCount).toBe(2);
  });

  it("wrongOnly: true with 0 missed items returns empty pack without creating a DB session", async () => {
    const pack = await createPracticePack({ count: 10, category: "TWK" });
    createdSessionIds.push(pack.sessionId);

    const [dbQ0] = await db
      .select({ correctOption: quizQuestions.correctOption })
      .from(quizQuestions)
      .where(eq(quizQuestions.id, pack.questions[0].id))
      .limit(1);

    await syncPracticeAttempt({
      sessionId: pack.sessionId,
      questionId: pack.questions[0].id,
      selectedOption: dbQ0.correctOption as "A" | "B" | "C" | "D" | "E",
    });

    const emptyRetry = await createPracticePack({
      wrongOnly: true,
      guestSessionIds: [pack.sessionId],
    });
    expect(emptyRetry).toEqual({
      sessionId: "",
      mode: "practice",
      totalCount: 0,
      questions: [],
    });
  });

  it("completing all questions in a pack transitions quiz_sessions.status to 'completed' with non-null scoreSummary", async () => {
    const pack = await createPracticePack({ count: 10, category: "TIU" });
    createdSessionIds.push(pack.sessionId);

    const keyRows = await db
      .select({
        id: quizQuestions.id,
        correctOption: quizQuestions.correctOption,
      })
      .from(quizQuestions)
      .where(
        inArray(
          quizQuestions.id,
          pack.questions.map((q) => q.id)
        )
      );
    const keyById = new Map(keyRows.map((r) => [r.id, r.correctOption!]));

    for (let i = 0; i < pack.questions.length; i++) {
      const q = pack.questions[i];
      const result = await syncPracticeAttempt({
        sessionId: pack.sessionId,
        questionId: q.id,
        selectedOption: keyById.get(q.id) as "A" | "B" | "C" | "D" | "E",
        timeSpentSeconds: 15,
      });

      if (i < pack.questions.length - 1) {
        expect(result.sessionCompleted).toBe(false);
      } else {
        expect(result.sessionCompleted).toBe(true);
      }
    }

    const [sessionRow] = await db
      .select()
      .from(quizSessions)
      .where(eq(quizSessions.id, pack.sessionId));

    expect(sessionRow.status).toBe("completed");
    expect(sessionRow.completedAt).not.toBeNull();
    expect(sessionRow.scoreSummary).not.toBeNull();
    expect((sessionRow.scoreSummary as Record<string, unknown>).totalScoreEarned).toBe(50);
  });

  it("rejects non-practice session modes with INVALID_SESSION_MODE and out-of-pack questions with QUESTION_NOT_IN_SESSION", async () => {
    const pack = await createPracticePack({ count: 10, category: "TWK" });
    createdSessionIds.push(pack.sessionId);

    const [outsideQuestion] = await db
      .select({ id: quizQuestions.id })
      .from(quizQuestions)
      .where(
        notInArray(
          quizQuestions.id,
          pack.questions.map((q) => q.id)
        )
      )
      .limit(1);
    expect(outsideQuestion).toBeDefined();

    await expect(
      syncPracticeAttempt({
        sessionId: pack.sessionId,
        questionId: outsideQuestion.id,
        selectedOption: "A",
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "QUESTION_NOT_IN_SESSION",
    });

    const [catSession] = await db
      .insert(quizSessions)
      .values({
        mode: "cat_tryout",
        status: "in_progress",
        durationSeconds: 6000,
        questionOrder: [pack.questions[0].id],
      })
      .returning({ id: quizSessions.id });
    createdSessionIds.push(catSession.id);

    await expect(
      syncPracticeAttempt({
        sessionId: catSession.id,
        questionId: pack.questions[0].id,
        selectedOption: "A",
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "INVALID_SESSION_MODE",
    });
  });

  it("POST /api/practice/pack & POST /api/practice/sync enforce signed skd_guest_sid cookie and reveal keys only on sync", async () => {
    const packRes = await postPracticePack(
      new NextRequest("http://localhost/api/practice/pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: 10, category: "TWK" }),
      })
    );
    expect(packRes.status).toBe(200);
    const setCookie = packRes.headers.get("set-cookie");
    expect(setCookie).toContain("skd_guest_sid=");
    const cookiePair = setCookie!.split(";")[0];

    const packBody = await packRes.json();
    expect(packBody.success).toBe(true);
    const sessionId = packBody.data.sessionId as string;
    createdSessionIds.push(sessionId);

    const firstQuestion = packBody.data.questions[0] as Record<string, unknown>;
    expect("correctOption" in firstQuestion).toBe(false);
    expect("scoringRubric" in firstQuestion).toBe(false);
    expect("optionRationales" in firstQuestion).toBe(false);
    expect("reasoningChain" in firstQuestion).toBe(false);

    // Cross-guest / missing-cookie sync attempt must be rejected with 403
    const unauthorizedSyncRes = await postPracticeSync(
      new NextRequest("http://localhost/api/practice/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          questionId: firstQuestion.id,
          selectedOption: "A",
        }),
      })
    );
    expect(unauthorizedSyncRes.status).toBe(403);

    // Owner sync with matching signed cookie succeeds and reveals answer & rationales
    const authorizedSyncRes = await postPracticeSync(
      new NextRequest("http://localhost/api/practice/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: cookiePair,
        },
        body: JSON.stringify({
          sessionId,
          questionId: firstQuestion.id,
          selectedOption: "A",
        }),
      })
    );
    expect(authorizedSyncRes.status).toBe(200);
    const syncBody = await authorizedSyncRes.json();
    expect(syncBody.success).toBe(true);
    expect(syncBody.data.correctOption).toMatch(/^[A-E]$/);
    expect(syncBody.data.optionRationales.A).toBeTruthy();
    expect(syncBody.data.reasoningChain).toBeTruthy();
    expect(typeof syncBody.data.isCorrect).toBe("boolean");
  });
});
