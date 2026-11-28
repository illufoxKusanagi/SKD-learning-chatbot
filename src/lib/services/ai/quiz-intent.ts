export const MAX_CHAT_QUIZ_BATCH = 30;
export type SkdSubtestCategory = 'TWK' | 'TIU' | 'TKP';

export interface QuizCategoryCounts {
  TWK: number;
  TIU: number;
  TKP: number;
}

export interface DetectedChatAndQuizIntent {
  detectedCategory: SkdSubtestCategory | null;
  isQuizRequest: boolean;
  wantsNewVariation: boolean;
  inheritedTopic?: string;
  isBlockedInjection: boolean;
  requestedQuizCounts: QuizCategoryCounts | null;
  rawTotalQuizRequested: number;
  totalQuizRequested: number;
  wasQuizCapped: boolean;
}

const SKD_CATEGORIES: readonly SkdSubtestCategory[] = ['TWK', 'TIU', 'TKP'];

const PROMPT_INJECTION_PATTERN =
  /\b(ignore\s+(?:all\s+|any\s+)?(?:previous|prior|above|system)\s+(?:instructions?|prompts?|rules?)|disregard\s+(?:previous|all|system)\s+(?:instructions?|rules?)|forget\s+(?:all\s+)?(?:previous|your)\s+(?:instructions?|rules?)|abaikan\s+(?:semua\s+)?(?:instruksi|aturan|perintah)\s+(?:sebelumnya|di\s+atas|sistem)|lupakan\s+(?:semua\s+)?(?:instruksi|aturan)|reveal\s+(?:your\s+)?system\s+prompt|tampilkan\s+(?:system\s+prompt|instruksi\s+sistem)|you\s+are\s+now\s+(?:a|an)\s+(?!peserta|asn)|berperan\s+sebagai\s+(?!tutor\s+skd|penguji\s+skd)|act\s+as\s+(?:a|an)\s+(?!skd|cpns)|jailbreak|developer\s+mode|dan\s+mode)\b/i;

const TWK_PATTERN =
  /\b(twk|wawasan\s+kebangsaan|pancasila|uud|pasal|bhinneka|nkri|bela\s+negara|nasionalisme|integritas|bahasa\s+indonesia|eyd|bpupki|ppki|sejarah)\b/i;
const TIU_PATTERN =
  /\b(tiu|inteligensia\s+umum|silogisme|analogi|deret|numerik|berhitung|pecahan|perbandingan|kecepatan|jarak|waktu|kuantitatif|analitis|figural|jaring-jaring|ketidaksamaan\s+gambar|analogi\s+gambar|matriks\s+gambar|logika|premis)\b/i;
const TKP_PATTERN =
  /\b(tkp|karakteristik\s+pribadi|pelayanan\s+publik|jejaring\s+kerja|sosial\s+budaya|tik|profesionalisme|anti\s+radikalisme|radikalisme|berakhlak|tempat\s+kerja|atasan|rekan\s+kerja|masyarakat)\b/i;
const FOLLOW_UP_PATTERN =
  /\b(lanjut(?:kan)?|lagi|berikutnya|selanjutnya|contoh(?:\s+lain|\s+lagi)?|rumus(?:nya)?|trik(?:nya)?|cara\s+cepat(?:nya)?|jelaskan|penjelasan|maksudnya|kenapa|mengapa|bagaimana\s+(?:jika|kalau|cara)|bedanya|perbedaannya|soal\s+lain|variasi\s+lain|lebih\s+detail|kurang\s+paham|belum\s+mengerti)\b/i;

export function isPromptInjectionAttempt(userQuery: string): boolean {
  return typeof userQuery === 'string' && PROMPT_INJECTION_PATTERN.test(userQuery);
}

function normalizeCategoryToken(token: string): SkdSubtestCategory | null {
  const upper = token.trim().toUpperCase();
  return upper === 'TWK' || upper === 'TIU' || upper === 'TKP' ? upper : null;
}

function splitCountAcrossCategories(
  total: number,
  categories: readonly SkdSubtestCategory[]
): QuizCategoryCounts {
  const counts: QuizCategoryCounts = { TWK: 0, TIU: 0, TKP: 0 };
  if (total <= 0 || categories.length === 0) return counts;
  const base = Math.floor(total / categories.length);
  const remainder = total % categories.length;
  categories.forEach((cat, idx) => {
    counts[cat] = base + (idx < remainder ? 1 : 0);
  });
  return counts;
}

export function capCategoryCountsToMax(counts: QuizCategoryCounts) {
  const rawTotal = counts.TWK + counts.TIU + counts.TKP;
  if (rawTotal <= MAX_CHAT_QUIZ_BATCH) {
    return { cappedCounts: { ...counts }, rawTotal, total: rawTotal, wasCapped: false };
  }

  const active = SKD_CATEGORIES.filter((cat) => counts[cat] > 0);
  const cappedCounts: QuizCategoryCounts = { TWK: 0, TIU: 0, TKP: 0 };
  const targets: Record<SkdSubtestCategory, number> = { TWK: 0, TIU: 0, TKP: 0 };

  for (const cat of active) {
    targets[cat] = (counts[cat] * MAX_CHAT_QUIZ_BATCH) / rawTotal;
    cappedCounts[cat] = Math.max(1, Math.floor(targets[cat]));
  }

  let sum = cappedCounts.TWK + cappedCounts.TIU + cappedCounts.TKP;
  while (sum < MAX_CHAT_QUIZ_BATCH) {
    let bestCat: SkdSubtestCategory | null = null;
    let bestDiff = -Infinity;
    for (const cat of active) {
      const diff = targets[cat] - cappedCounts[cat];
      if (diff > bestDiff) {
        bestDiff = diff;
        bestCat = cat;
      }
    }
    if (!bestCat) break;
    cappedCounts[bestCat] += 1;
    sum += 1;
  }

  while (sum > MAX_CHAT_QUIZ_BATCH) {
    let trimCat: SkdSubtestCategory | null = null;
    let minNeed = Infinity;
    for (const cat of active) {
      if (cappedCounts[cat] <= 1) continue;
      const need = cappedCounts[cat] - 1 - targets[cat];
      if (need < minNeed) {
        minNeed = need;
        trimCat = cat;
      }
    }
    if (!trimCat) break;
    cappedCounts[trimCat] -= 1;
    sum -= 1;
  }

  return { cappedCounts, rawTotal, total: sum, wasCapped: true };
}

function extractExplicitPerCategoryCounts(queryLower: string): QuizCategoryCounts | null {
  const counts: QuizCategoryCounts = { TWK: 0, TIU: 0, TKP: 0 };
  const spans: Array<{ start: number; end: number }> = [];
  const overlaps = (start: number, end: number) => spans.some((s) => start < s.end && end > s.start);

  const countBeforeCat =
    /\b(\d{1,3})\s*(?:butir\s+|buah\s+)?(?:soal|quiz|kuis|latihan|questions?)?\s*(twk|tiu|tkp)\b/gi;
  for (let m = countBeforeCat.exec(queryLower); m !== null; m = countBeforeCat.exec(queryLower)) {
    const n = Number(m[1]);
    const cat = normalizeCategoryToken(m[2]);
    if (cat && Number.isFinite(n) && n > 0) {
      counts[cat] += n;
      spans.push({ start: m.index, end: m.index + m[0].length });
    }
  }

  const catBeforeCount = /\b(twk|tiu|tkp)\s*(?:[:=-]|\s+sebanyak)?\s*(\d{1,3})\b/gi;
  for (let m = catBeforeCount.exec(queryLower); m !== null; m = catBeforeCount.exec(queryLower)) {
    const start = m.index;
    const end = start + m[0].length;
    const prefix = queryLower.slice(Math.max(0, start - 20), start);
    if (!overlaps(start, end) && !/\b(?:skor|nilai|poin|grade|batas)\s+$/i.test(prefix)) {
      const cat = normalizeCategoryToken(m[1]);
      const n = Number(m[2]);
      if (cat && Number.isFinite(n) && n > 0) {
        counts[cat] += n;
        spans.push({ start, end });
      }
    }
  }

  return counts.TWK + counts.TIU + counts.TKP > 0 ? counts : null;
}

function matchFirstPositiveInt(queryLower: string, patterns: readonly RegExp[]): number | null {
  for (const pattern of patterns) {
    const match = queryLower.match(pattern);
    const n = match?.[1] ? Number(match[1]) : NaN;
    if (Number.isFinite(n) && n >= 1) return n;
  }
  return null;
}

function finalizeCappedCounts(rawCounts: QuizCategoryCounts) {
  const { cappedCounts, rawTotal, total, wasCapped } = capCategoryCountsToMax(rawCounts);
  return { requestedQuizCounts: cappedCounts, rawTotalQuizRequested: rawTotal, totalQuizRequested: total, wasQuizCapped: wasCapped };
}

function parseQuizRequestCounts(
  queryLower: string,
  detectedCategory: SkdSubtestCategory | null,
  matchedCategories: readonly SkdSubtestCategory[]
) {
  const explicitCounts = extractExplicitPerCategoryCounts(queryLower);
  if (explicitCounts) return finalizeCappedCounts(explicitCounts);

  const distributiveCount = matchFirstPositiveInt(queryLower, [
    /\b(\d{1,3})\s*(?:butir\s+|buah\s+)?(?:soal|latihan|kuis|quiz|quizzes|questions?)?\s*(?:each(?:\s+(?:part|section|subtest|category))?|masing[\s-]*masing|per\s+(?:bagian|subtes|kategori))\b/i,
    /\b(?:masing[\s-]*masing|each(?:\s+(?:part|section|subtest|category))?|per\s+(?:bagian|subtes|kategori))\s*(?:sebanyak\s+)?(\d{1,3})\s*(?:butir\s+|buah\s+)?(?:soal|latihan|kuis|quiz|quizzes|questions?)?\b/i,
  ]);
  if (distributiveCount !== null) {
    const targets = matchedCategories.length > 0 ? matchedCategories : SKD_CATEGORIES;
    const rawCounts: QuizCategoryCounts = { TWK: 0, TIU: 0, TKP: 0 };
    for (const cat of targets) rawCounts[cat] = distributiveCount;
    return finalizeCappedCounts(rawCounts);
  }

  const generalCount = matchFirstPositiveInt(queryLower, [
    /\b(\d{1,3})\s*(?:butir\s+|buah\s+)?(?:soal|latihan|kuis|quiz|quizzes|questions?)\b/i,
    /\b(?:soal|kuis|quiz|questions?)\s*(?:sebanyak\s+)?(\d{1,3})\b/i,
  ]);
  if (generalCount !== null) {
    if (detectedCategory) {
      return finalizeCappedCounts({
        TWK: detectedCategory === 'TWK' ? generalCount : 0,
        TIU: detectedCategory === 'TIU' ? generalCount : 0,
        TKP: detectedCategory === 'TKP' ? generalCount : 0,
      });
    }
    if (matchedCategories.length === 2) {
      return finalizeCappedCounts(splitCountAcrossCategories(generalCount, matchedCategories));
    }
    if (generalCount === 1) {
      return { requestedQuizCounts: null, rawTotalQuizRequested: 1, totalQuizRequested: 1, wasQuizCapped: false };
    }
    return finalizeCappedCounts(splitCountAcrossCategories(generalCount, SKD_CATEGORIES));
  }

  return {
    requestedQuizCounts: detectedCategory
      ? {
          TWK: detectedCategory === 'TWK' ? 1 : 0,
          TIU: detectedCategory === 'TIU' ? 1 : 0,
          TKP: detectedCategory === 'TKP' ? 1 : 0,
        }
      : null,
    rawTotalQuizRequested: 1,
    totalQuizRequested: 1,
    wasQuizCapped: false,
  };
}

export function detectSkdCategoryAndIntent(
  userQuery: string,
  history?: { role: string; content: string }[]
): DetectedChatAndQuizIntent {
  if (isPromptInjectionAttempt(userQuery)) {
    return {
      detectedCategory: null, isQuizRequest: false, wantsNewVariation: false,
      isBlockedInjection: true, requestedQuizCounts: null,
      rawTotalQuizRequested: 0, totalQuizRequested: 0, wasQuizCapped: false,
    };
  }

  const queryLower = userQuery.toLowerCase();
  const matchedCategories: SkdSubtestCategory[] = [];
  if (TWK_PATTERN.test(queryLower)) matchedCategories.push('TWK');
  if (TIU_PATTERN.test(queryLower)) matchedCategories.push('TIU');
  if (TKP_PATTERN.test(queryLower)) matchedCategories.push('TKP');

  let detectedCategory: SkdSubtestCategory | null =
    matchedCategories.length === 1 ? matchedCategories[0] : null;
  let inheritedTopic: string | undefined;

  if (
    !detectedCategory &&
    matchedCategories.length === 0 &&
    userQuery.trim().length < 60 &&
    history?.length &&
    FOLLOW_UP_PATTERN.test(queryLower)
  ) {
    const recentTurns = history.slice(-2);
    for (let i = recentTurns.length - 1; i >= 0; i--) {
      const h = recentTurns[i].content.toLowerCase();
      const cat = TWK_PATTERN.test(h) ? 'TWK' : TIU_PATTERN.test(h) ? 'TIU' : TKP_PATTERN.test(h) ? 'TKP' : null;
      if (cat) {
        detectedCategory = cat;
        inheritedTopic = recentTurns[i].content.slice(0, 80);
        break;
      }
    }
  }

  const isGeneralInfoOnly =
    /^(apa itu skd|apa itu cpns|pengertian skd|informasi skd|passing grade|ambang batas)\??$/i.test(queryLower.trim());
  const refersToPreviousQuiz =
    /\b(soal\s+(tadi|ini|sebelumnya|itu|tersebut|barusan)|jawaban\s+(tadi|saya|benar)|kenapa|mengapa|jelaskan|pembahasan|bahas\s+soal)\b/i.test(queryLower);
  const explicitVerbQuizPattern =
    /\b((berikan|beri|kasih|minta|buatkan|buat|mau|ingin|coba|tolong|give(?:\s+me)?|make(?:\s+me)?|want(?:\s+to\s+do)?|need|generate|create|ask(?:\s+me)?)\s+(?:saya\s+|aku\s+)?(\d+\s+)?(soal|butir\s+soal|latihan|kuis|quiz|quizzes|questions?|simulasi))\b/i;
  const commonQuizPhrasePattern =
    /\b(latihan\s+soal|contoh\s+soal|soal\s+lagi|lanjut\s+soal|next\s+quiz|more\s+quiz(?:zes)?|(kasih|tes|simulasi|quiz|kuis|latihan)\s+(twk|tiu|tkp|skd))\b/i;
  const isExamInfoCountQuestion =
    /\b(berapa|jumlah\s+soal(?:\s+resmi)?|passing\s+grade)\b/i.test(queryLower);
  const shorthandCategoryCountPattern =
    /\b(\d{1,3})\s*(?:soal|butir|quiz|kuis|questions?)?\s*(twk|tiu|tkp)\b|\b(twk|tiu|tkp)\s*[:=-]?\s*(\d{1,3})\s*(?:soal|butir|quiz|kuis|questions?)?\b|\b(\d{1,3})\s*(?:butir\s+|buah\s+)?(?:soal|latihan|kuis|quiz|quizzes|questions?)\s+(?:skd|cpns|each|masing[\s-]*masing|per\s+(?:bagian|subtes|kategori))\b|\b(?:masing[\s-]*masing|each(?:\s+part)?)\s+(\d{1,3})\s*(?:butir\s+|buah\s+)?(?:soal|latihan|kuis|quiz|quizzes|questions?)\b/i;

  const isQuizRequest =
    !isGeneralInfoOnly &&
    !refersToPreviousQuiz &&
    (explicitVerbQuizPattern.test(queryLower) ||
      commonQuizPhrasePattern.test(queryLower) ||
      (!isExamInfoCountQuestion && shorthandCategoryCountPattern.test(queryLower)));

  const wantsNewVariation =
    /\b(variasi\s+baru|soal\s+baru\s+buatan\s+ai|isu\s+terkini|karang\s+soal\s+baru)\b/i.test(queryLower);

  const countsInfo = isQuizRequest
    ? parseQuizRequestCounts(queryLower, detectedCategory, matchedCategories)
    : { requestedQuizCounts: null, rawTotalQuizRequested: 0, totalQuizRequested: 0, wasQuizCapped: false };

  return {
    detectedCategory,
    isQuizRequest,
    wantsNewVariation,
    ...(inheritedTopic ? { inheritedTopic } : {}),
    isBlockedInjection: false,
    ...countsInfo,
  };
}
