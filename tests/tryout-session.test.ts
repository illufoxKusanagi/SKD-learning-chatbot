import { afterAll, describe, expect, it, vi } from "vitest";

vi.hoisted(async () => {
  const dotenv = await import("dotenv");
  dotenv.config({ path: ".env.local" });
  dotenv.config({ path: ".env" });
});

vi.mock("@/lib/services/ai/embeddings.service", () => ({
  generateEmbedding: vi.fn(() => {
    throw new Error("generateEmbedding MUST NOT be called in Tryout");
  }),
}));

vi.mock("@/lib/services/ai/gemini.service", () => ({
  generateAiResponse: vi.fn(() => {
    throw new Error("generateAiResponse MUST NOT be called in Tryout");
  }),
}));

import { and, eq, inArray } from "drizzle-orm";
import { NextRequest } from "next/server";
import { closeConnection, db, quizAttempts, quizSessions } from "@/lib/db";
import {
  finalizeTryoutSession,
  getTryoutBankReadiness,
  getTryoutSessionState,
  startTryoutSession,
  updateTryoutProgress,
  type TryoutQuestionReviewItem,
} from "@/lib/services/tryout.service";
import { GET as getReadinessRoute } from "@/app/api/tryout/readiness/route";
import {
  GET as listSessionsRoute,
  POST as startSessionRoute,
} from "@/app/api/tryout/sessions/route";
import {
  GET as getSessionDetailRoute,
  PATCH as patchSessionProgressRoute,
  POST as postSessionActionRoute,
} from "@/app/api/tryout/sessions/[id]/route";

describe("CAT Readiness Guard & Persistent Exam Session Engine", () => {
  const createdSessionIds: string[] = [];

  afterAll(async () => {
    if (createdSessionIds.length > 0) {
      await db
        .delete(quizSessions)
        .where(inArray(quizSessions.id, createdSessionIds));
    }
    await closeConnection();
  });

  it("Bank Readiness Guard marks fullCat not ready on deficit counts and both ready on seeded PostgreSQL", async () => {
    const partial = await getTryoutBankReadiness({ TWK: 20, TIU: 20, TKP: 20 });
    expect(partial.counts).toEqual({ TWK: 20, TIU: 20, TKP: 20, total: 60 });
    expect(partial.fullCat.ready).toBe(false);
    expect(partial.fullCat.deficits).toEqual({ TWK: 10, TIU: 15, TKP: 25 });
    expect(partial.fullCat.durationSeconds).toBe(6000);
    expect(partial.fullCat.passingGrades).toEqual({ TWK: 65, TIU: 80, TKP: 166 });

    expect(partial.miniCat.ready).toBe(true);
    expect(partial.miniCat.deficits).toEqual({ TWK: 0, TIU: 0, TKP: 0 });
    expect(partial.miniCat.durationSeconds).toBe(1620);
    expect(partial.miniCat.passingGrades).toEqual({ TWK: 18, TIU: 23, TKP: 45 });

    const live = await getTryoutBankReadiness();
    expect(live.counts.TWK).toBeGreaterThanOrEqual(30);
    expect(live.counts.TIU).toBeGreaterThanOrEqual(35);
    expect(live.counts.TKP).toBeGreaterThanOrEqual(45);
    expect(live.fullCat.ready).toBe(true);
    expect(live.miniCat.ready).toBe(true);
  });

  it("Active Exam enforces strict answer-key masking and sequential 30 TWK / 35 TIU / 45 TKP ordering", async () => {
    const session = await startTryoutSession({ mode: "cat_tryout" });
    createdSessionIds.push(session.id);

    expect(session.mode).toBe("cat_tryout");
    expect(session.status).toBe("in_progress");
    expect(session.durationSeconds).toBe(6000);
    expect(session.remainingSeconds).toBeGreaterThan(5990);
    expect(session.remainingSeconds).toBeLessThanOrEqual(6000);
    expect(session.totalQuestions).toBe(110);
    expect(session.questions).toHaveLength(110);
    expect(session.scoreSummary).toBeNull();

    const twkSlice = session.questions.slice(0, 30);
    const tiuSlice = session.questions.slice(30, 65);
    const tkpSlice = session.questions.slice(65, 110);

    expect(twkSlice.every((q, idx) => q.category === "TWK" && q.number === idx + 1)).toBe(true);
    expect(tiuSlice.every((q, idx) => q.category === "TIU" && q.number === idx + 31)).toBe(true);
    expect(tkpSlice.every((q, idx) => q.category === "TKP" && q.number === idx + 66)).toBe(true);

    const sensitiveKeys = [
      "correctOption",
      "scoringRubric",
      "hint",
      "optionRationales",
      "reasoningChain",
      "materials",
    ];
    for (const q of session.questions) {
      for (const key of sensitiveKeys) {
        expect(key in q).toBe(false);
      }
      expect(q.selectedOption).toBeNull();
      expect(q.isFlagged).toBe(false);
      expect(q.timeSpentSeconds).toBe(0);
    }
  });

  it("supports idempotent A -> D answer changes, time accumulation, and Ragu-ragu flag toggles", async () => {
    const session = await startTryoutSession({ mode: "mini_tryout" });
    createdSessionIds.push(session.id);

    const q1 = session.questions[0];

    const first = await updateTryoutProgress({
      sessionId: session.id,
      questionId: q1.id,
      selectedOption: "A",
      isFlagged: true,
      timeSpentDeltaSeconds: 12,
    });
    expect(first.selectedOption).toBe("A");
    expect(first.isFlagged).toBe(true);
    expect(first.answeredCount).toBe(1);
    expect(first.flaggedQuestionIds).toEqual([q1.id]);

    const second = await updateTryoutProgress({
      sessionId: session.id,
      questionId: q1.id,
      selectedOption: "D",
      isFlagged: false,
      timeSpentDeltaSeconds: 8,
    });
    expect(second.selectedOption).toBe("D");
    expect(second.isFlagged).toBe(false);
    expect(second.answeredCount).toBe(1);
    expect(second.flaggedQuestionIds).toEqual([]);

    const attemptRows = await db
      .select()
      .from(quizAttempts)
      .where(
        and(
          eq(quizAttempts.sessionId, session.id),
          eq(quizAttempts.questionId, q1.id)
        )
      );
    expect(attemptRows).toHaveLength(1);
    expect(attemptRows[0].userAnswer).toBe("D");
    expect(attemptRows[0].timeSpentSeconds).toBe(20);
    expect(attemptRows[0].status).toBe("pending");
    expect(attemptRows[0].scoreEarned).toBeNull();
  });

  it("persists server timer on reload and auto-finalizes with revealed keys on expiry", async () => {
    const session = await startTryoutSession({ mode: "mini_tryout" });
    createdSessionIds.push(session.id);

    const startedAt = new Date(session.startedAt);
    const q1 = session.questions[0]; // TWK

    await updateTryoutProgress({
      sessionId: session.id,
      questionId: q1.id,
      selectedOption: "A",
      timeSpentDeltaSeconds: 15,
    });

    const midState = await getTryoutSessionState({
      sessionId: session.id,
      now: new Date(startedAt.getTime() + 1500_000),
    });
    expect(midState.status).toBe("in_progress");
    expect(midState.remainingSeconds).toBe(120);
    expect("correctOption" in midState.questions[0]).toBe(false);

    const expiredState = await getTryoutSessionState({
      sessionId: session.id,
      now: new Date(startedAt.getTime() + 1625_000),
    });
    expect(expiredState.status).toBe("completed");
    expect(expiredState.remainingSeconds).toBe(0);
    expect(expiredState.scoreSummary).not.toBeNull();
    expect(expiredState.scoreSummary?.mode).toBe("mini_tryout");
    expect(expiredState.scoreSummary?.byCategory.TWK.questionCount).toBe(8);
    expect(expiredState.scoreSummary?.byCategory.TIU.questionCount).toBe(10);
    expect(expiredState.scoreSummary?.byCategory.TKP.questionCount).toBe(12);

    const reviewedTwk = expiredState.questions[0] as TryoutQuestionReviewItem;
    expect(reviewedTwk.category).toBe("TWK");
    expect(reviewedTwk.correctOption).toMatch(/^[A-E]$/);
    expect(reviewedTwk.optionRationales.A).toBeTruthy();
    expect(reviewedTwk.hint).toBeTruthy();
    expect(reviewedTwk.reasoningChain).toBeTruthy();
    expect(Array.isArray(reviewedTwk.materials)).toBe(true);
    expect(reviewedTwk.materials.length).toBeGreaterThanOrEqual(1);

    const reviewedTkp = expiredState.questions[29] as TryoutQuestionReviewItem;
    expect(reviewedTkp.category).toBe("TKP");
    expect(reviewedTkp.correctOption).toBeNull();
    expect(reviewedTkp.scoringRubric).not.toBeNull();
    expect(reviewedTkp.materials).toEqual([]);
  });

  it("locks completed sessions against further edits (409) and finalizes idempotently", async () => {
    const session = await startTryoutSession({ mode: "mini_tryout" });
    createdSessionIds.push(session.id);

    const q1 = session.questions[0];
    await updateTryoutProgress({
      sessionId: session.id,
      questionId: q1.id,
      selectedOption: "B",
      timeSpentDeltaSeconds: 10,
    });

    const firstFinish = await finalizeTryoutSession({ sessionId: session.id });
    expect(firstFinish.status).toBe("completed");
    expect(firstFinish.scoreSummary).not.toBeNull();

    await expect(
      updateTryoutProgress({
        sessionId: session.id,
        questionId: q1.id,
        selectedOption: "C",
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "EXAM_ALREADY_FINISHED",
    });

    const secondFinish = await finalizeTryoutSession({ sessionId: session.id });
    expect(secondFinish.status).toBe("completed");
    expect(secondFinish.scoreSummary).toEqual(firstFinish.scoreSummary);
  });

  it("prevents TOCTOU race between concurrent updateTryoutProgress and finalizeTryoutSession", async () => {
    const session = await startTryoutSession({ mode: "mini_tryout" });
    createdSessionIds.push(session.id);

    const q1 = session.questions[0];
    const q2 = session.questions[1];

    await updateTryoutProgress({
      sessionId: session.id,
      questionId: q1.id,
      selectedOption: "A",
      timeSpentDeltaSeconds: 5,
    });

    const [updateResult, finalizeResult] = await Promise.allSettled([
      updateTryoutProgress({
        sessionId: session.id,
        questionId: q2.id,
        selectedOption: "D",
        isFlagged: true,
        timeSpentDeltaSeconds: 7,
      }),
      finalizeTryoutSession({ sessionId: session.id }),
    ]);

    expect(finalizeResult.status).toBe("fulfilled");
    if (updateResult.status === "rejected") {
      expect(updateResult.reason).toMatchObject({
        statusCode: 409,
        code: "EXAM_ALREADY_FINISHED",
      });
    }

    const [sessionRow] = await db
      .select()
      .from(quizSessions)
      .where(eq(quizSessions.id, session.id));
    expect(sessionRow.status).toBe("completed");

    const attemptRows = await db
      .select()
      .from(quizAttempts)
      .where(eq(quizAttempts.sessionId, session.id));

    expect(attemptRows.length).toBeGreaterThanOrEqual(1);
    for (const attempt of attemptRows) {
      expect(attempt.status).not.toBe("pending");
      expect(attempt.scoreEarned).not.toBeNull();
    }
  });

  it("wires Tryout HTTP routes cleanly (readiness, start/list, get/patch/finish)", async () => {
    const readinessRes = await getReadinessRoute(
      new NextRequest("http://localhost/api/tryout/readiness")
    );
    expect(readinessRes.status).toBe(200);
    const readinessBody = await readinessRes.json();
    expect(readinessBody.success).toBe(true);
    expect(readinessBody.data.miniCat.ready).toBe(true);

    const startRes = await startSessionRoute(
      new NextRequest("http://localhost/api/tryout/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "mini_tryout" }),
      })
    );
    expect(startRes.status).toBe(201);
    const startBody = await startSessionRouteBody(startRes);
    const sessionId = startBody.data.id as string;
    createdSessionIds.push(sessionId);

    const listRes = await listSessionsRoute(
      new NextRequest(`http://localhost/api/tryout/sessions?sessionIds=${sessionId}`)
    );
    expect(listRes.status).toBe(200);
    const listBody = await listRes.json();
    expect(listBody.success).toBe(true);
    expect(listBody.data.some((s: { id: string }) => s.id === sessionId)).toBe(true);

    const q1Id = startBody.data.questions[0].id as string;
    const patchRes = await patchSessionProgressRoute(
      new NextRequest(`http://localhost/api/tryout/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: q1Id,
          selectedOption: "C",
          isFlagged: true,
          timeSpentDeltaSeconds: 5,
        }),
      }),
      { params: Promise.resolve({ id: sessionId }) }
    );
    expect(patchRes.status).toBe(200);
    const patchBody = await patchRes.json();
    expect(patchBody.data.selectedOption).toBe("C");
    expect(patchBody.data.isFlagged).toBe(true);

    const finishRes = await postSessionActionRoute(
      new NextRequest(`http://localhost/api/tryout/sessions/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "finish" }),
      }),
      { params: Promise.resolve({ id: sessionId }) }
    );
    expect(finishRes.status).toBe(200);
    const finishBody = await finishRes.json();
    expect(finishBody.data.status).toBe("completed");
    expect(finishBody.data.scoreSummary).not.toBeNull();

    const getCompletedRes = await getSessionDetailRoute(
      new NextRequest(`http://localhost/api/tryout/sessions/${sessionId}`),
      { params: Promise.resolve({ id: sessionId }) }
    );
    expect(getCompletedRes.status).toBe(200);
    const getCompletedBody = await getCompletedRes.json();
    expect(getCompletedBody.data.status).toBe("completed");
  });
});

async function startSessionRouteBody(res: Response) {
  return (await res.json()) as {
    success: boolean;
    data: {
      id: string;
      questions: Array<{ id: string }>;
    };
  };
}
