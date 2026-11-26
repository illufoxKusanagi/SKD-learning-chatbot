import { GoogleGenAI } from '@google/genai';
import { SkdRetrievalResult, SkdQuizMetadata } from './rag.service';
import {
  buildDeepTutorPrompt,
  type DeepTutorQuizContext,
} from '@/lib/services/material.service';

export interface ChatHistoryTurn {
  role: 'user' | 'bot' | 'model';
  content: string;
}

export interface LockedQuizEvaluation {
  quizId: string;
  category: 'TWK' | 'TIU' | 'TKP';
  subtest?: 'TWK' | 'TIU' | 'TKP';
  subtopic: string;
  questionStem: string;
  options: { A: string; B: string; C: string; D: string; E: string };
  correctOption: 'A' | 'B' | 'C' | 'D' | 'E' | null;
  scoringRubric: { A: number; B: number; C: number; D: number; E: number } | null;
  rubricRationale: string | null;
  userAnswer: 'A' | 'B' | 'C' | 'D' | 'E';
  scoreEarned: number;
  maxScore: number;
  isCorrect?: boolean;
}

export interface GenerateAiResponseOptions {
  history?: ChatHistoryTurn[];
  ragResult?: SkdRetrievalResult;
  lockedQuizEvaluation?: LockedQuizEvaluation;
  deepTutorContext?: DeepTutorQuizContext | null;
}

let genAIClient: GoogleGenAI | null = null;

function getGenAIClient(): GoogleGenAI {
  if (genAIClient) return genAIClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not defined in environment variables.');
  }
  genAIClient = new GoogleGenAI({ apiKey });
  return genAIClient;
}

const getGenerativeModel = () =>
  process.env.GENERATIVE_MODEL || 'gemini-2.5-flash';

const getFallbackModel = () =>
  process.env.GEMINI_FALLBACK_MODEL || 'gemini-2.5-flash-lite';

const getTertiaryModel = () =>
  process.env.GEMINI_TERTIARY_MODEL || 'gemini-2.0-flash';

function buildModelCascade(): string[] {
  return Array.from(
    new Set(
      [getGenerativeModel(), getFallbackModel(), getTertiaryModel()].filter(
        Boolean
      )
    )
  );
}

export function shouldEnableGoogleSearch(userMessage: string): boolean {
  if (process.env.ENABLE_GEMINI_GOOGLE_SEARCH !== 'true') {
    return false;
  }
  return /\b(berita\s+terbaru|isu\s+terkini|aturan\s+terbaru|regulasi\s+terbaru|ikn\s+terkini|cpns\s+202[5-9])\b/i.test(
    userMessage
  );
}

function isTransientGeminiOverloadError(error: unknown): boolean {
  const raw =
    error instanceof Error
      ? `${error.name} ${error.message}`
      : String(error ?? '');
  return /\b(503|429|UNAVAILABLE|RESOURCE_EXHAUSTED|ECONNRESET)\b|overloaded|high\s+demand|try\s+again\s+later|fetch\s+failed/i.test(
    raw
  );
}

function parseRetryDelayMs(error: unknown, hopIndex: number): number {
  const raw =
    error instanceof Error
      ? `${error.name} ${error.message}`
      : String(error ?? '');

  const retryInMatch = raw.match(/retry\s+in\s+(\d+(?:\.\d+)?)s/i);
  if (retryInMatch) {
    const ms = Math.round(Number(retryInMatch[1]) * 1000);
    if (Number.isFinite(ms)) {
      return Math.min(3500, Math.max(900, ms));
    }
  }

  const retryDelayMatch = raw.match(
    /retryDelay["']?\s*[:=]\s*["']?(\d+(?:\.\d+)?)(ms|s)?/i
  );
  if (retryDelayMatch) {
    const val = Number(retryDelayMatch[1]);
    const unit = retryDelayMatch[2]?.toLowerCase();
    const ms = Math.round(unit === 'ms' ? val : val * 1000);
    if (Number.isFinite(ms)) {
      return Math.min(3500, Math.max(900, ms));
    }
  }

  if (hopIndex === 0) {
    return Math.round(1000 + Math.random() * 500);
  }
  return Math.round(2000 + Math.random() * 700);
}

export interface ClassifiedAiError {
  code:
    | 'TOKEN_LIMIT_EXCEEDED'
    | 'MODEL_OVERLOADED'
    | 'RATE_LIMITED'
    | 'STREAM_TIMEOUT'
    | 'AI_STREAM_ERROR';
  title: string;
  message: string;
}

export function classifyAiStreamError(error: unknown): ClassifiedAiError {
  const raw =
    error instanceof Error
      ? `${error.name} ${error.message}`
      : String(error ?? '');

  if (
    /\b(MAX_TOKENS|TOKEN_LIMIT|context\s*length|too\s*many\s*tokens|token\s*limit|exceeds?\s*the\s*maximum\s*number\s*of\s*tokens|input\s*tokens?)\b/i.test(
      raw
    )
  ) {
    return {
      code: 'TOKEN_LIMIT_EXCEEDED',
      title: 'Batas Token Percakapan Tercapai',
      message:
        'Konteks percakapan atau respons terlalu panjang untuk satu giliran. Silakan mulai percakapan baru atau kirim pertanyaan yang lebih spesifik.',
    };
  }

  if (/\b429\b|RESOURCE_EXHAUSTED|quota|rate\s*limit|RPM|TPM|RPD/i.test(raw)) {
    return {
      code: 'RATE_LIMITED',
      title: 'Batas Kuota API Gemini Tercapai (429)',
      message:
        'Permintaan mencapai batas kuota per menit/hari API Gemini. Tunggu 15–30 detik lalu klik Coba Lagi.',
    };
  }

  if (/\b503\b|UNAVAILABLE|high\s*demand|overloaded/i.test(raw)) {
    return {
      code: 'MODEL_OVERLOADED',
      title: 'Server Gemini Sedang Sibuk (503)',
      message:
        'Server model utama sedang padat. Silakan tunggu beberapa detik lalu klik Coba Lagi.',
    };
  }

  if (/AbortError|TimeoutError|timed?\s*out|deadline/i.test(raw)) {
    return {
      code: 'STREAM_TIMEOUT',
      title: 'Waktu Respons Habis',
      message:
        'Server AI membutuhkan waktu terlalu lama untuk merespons. Silakan klik Coba Lagi.',
    };
  }

  return {
    code: 'AI_STREAM_ERROR',
    title: 'Gagal Memuat Respons Tutor AI',
    message:
      'Terjadi gangguan saat memproses jawaban dari server AI. Silakan klik Coba Lagi.',
  };
}

export interface StreamGeminiCascadeOptions {
  ai?: {
    models: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      generateContentStream: (args: any) => Promise<AsyncIterable<any>>;
    };
  };
  models?: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  contents: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: any;
  isQuizRequest?: boolean;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractTextFromChunk(chunk: any): string {
  const parts = chunk?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts) && parts.length > 0) {
    let text = '';
    for (const part of parts) {
      if (part && !part.thought && typeof part.text === 'string') {
        text += part.text;
      }
    }
    return text;
  }
  return typeof chunk?.text === 'string' ? chunk.text : '';
}

export async function* streamGeminiWithCascade(
  options: StreamGeminiCascadeOptions
): AsyncGenerator<string> {
  const ai = options.ai ?? getGenAIClient();
  const modelChain =
    options.models && options.models.length > 0
      ? Array.from(new Set(options.models.filter(Boolean)))
      : buildModelCascade();
  const sleep = options.sleep ?? defaultSleep;

  let hasYieldedAnyText = false;

  for (let i = 0; i < modelChain.length; i++) {
    const currentModel = modelChain[i];
    const isFallback = i > 0;
    const isGemini25 = currentModel.startsWith('gemini-2.5');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const baseConfig: Record<string, any> = options.config
      ? { ...options.config }
      : {};

    if (isFallback) {
      delete baseConfig.tools;
      delete baseConfig.thinkingConfig;
      if (isGemini25) {
        baseConfig.thinkingConfig = { thinkingBudget: 0 };
      }
    } else if (!isGemini25) {
      delete baseConfig.thinkingConfig;
    }

    try {
      const response = await ai.models.generateContentStream({
        model: currentModel,
        contents: options.contents,
        config: baseConfig,
      });

      let sawMaxTokens = false;
      let accumulatedText = '';

      for await (const chunk of response) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const finishReason = (chunk as any)?.candidates?.[0]?.finishReason;
        if (finishReason === 'MAX_TOKENS') {
          sawMaxTokens = true;
          console.warn(
            `[GeminiService] Response hit MAX_TOKENS on model "${currentModel}"`
          );
        }

        const text = extractTextFromChunk(chunk);
        if (text) {
          hasYieldedAnyText = true;
          accumulatedText += text;
          yield text;
        }
      }

      if (
        sawMaxTokens &&
        options.isQuizRequest &&
        !extractQuizMetaFromText(accumulatedText).quizMeta
      ) {
        throw new Error(
          'MAX_TOKENS: Output terpotong karena batas token maksimum tercapai'
        );
      }

      return;
    } catch (err) {
      if (
        hasYieldedAnyText ||
        !isTransientGeminiOverloadError(err) ||
        i === modelChain.length - 1
      ) {
        throw err;
      }

      const delayMs = parseRetryDelayMs(err, i);
      const nextModel = modelChain[i + 1];
      console.warn(
        `[GeminiService] Model "${currentModel}" transient failure before first chunk. Retrying in ${delayMs}ms with "${nextModel}"...`
      );
      await sleep(delayMs);
    }
  }
}

export const SKD_SYSTEM_INSTRUCTION = `Anda adalah Tutor Ahli SKD CPNS (TWK, TIU, TKP) berstandar kurikulum resmi KepmenPANRB dan BKN Republik Indonesia. Tugas utama Anda adalah membimbing peserta lulus seleksi CPNS dengan pemahaman konsep mendalam, trik cepat, dan latihan soal berbasis Higher Order Thinking Skills (HOTS).

KETENTUAN RESMI UJIAN SKD CPNS:
1. TES WAWASAN KEBANGSAAN (TWK):
   - Jumlah Soal: 30 butir | Passing Grade: 65 | Nilai: Benar +5, Salah/Kosong 0 (Maksimal 150).
   - Fokus Materi: Penalaran HOTS Nasionalisme, Integritas ASN & Nilai Anti-Korupsi KPK, Bela Negara (5 Nilai Dasar UU No. 23/2019), Pilar Negara (Pengamalan Butir Pancasila, UUD NRI 1945 Pasca Amandemen I-IV, NKRI, Bhinneka Tunggal Ika), serta Bahasa Negara (Kaidah Kalimat Efektif & Ejaan EYD V).
   - Analisis Kasus: Uji kemampuan peserta dalam menempatkan kepentingan bangsa di atas kepentingan pribadi/golongan dan integritas moral aparatur negara.

2. TES INTELIGENSIA UMUM (TIU):
   - Jumlah Soal: 35 butir | Passing Grade: 80 | Nilai: Benar +5, Salah/Kosong 0 (Maksimal 175).
   - Fokus Materi:
     * Verbal: Analogi kata logis, Silogisme (penarikan kesimpulan modus ponens/tollens/silogisme, kuantor semua/sebagian), dan Analitis (posisi urutan/jadwal/pemetaan kondisi).
     * Numerik: Berhitung Cepat (aljabar, pecahan, persentase), Deret Angka (pola bertingkat, larik Fibonacci, selang-seling), Perbandingan Kuantitatif (senilai, berbalik nilai, pekerja gabungan), dan Soal Cerita (kecepatan rata-rata, jarak, waktu berpapasan/menyusul).
     * Figural: Analogi gambar, ketidaksamaan (odd-one-out), dan serial pola rotasi/pencerminan.
   - METODE WAJIB: Selalu sertakan langkah matematis/logis yang runtut dan berikan "💡 Trik Cepat SKD (< 50 detik)" tanpa rumus bertele-tele.

3. TES KARAKTERISTIK PRIBADI (TKP):
   - Jumlah Soal: 45 butir | Passing Grade: 166 | Nilai: Skala Gradasi 1 s.d. 5 untuk SETIAP Opsi A-E (Maksimal 225).
   - Core Values ASN BerAKHLAK:
     * Berorientasi Pelayanan: Cepat tanggap, ramah, solutif, kepuasan masyarakat.
     * Akuntabel: Jujur, bertanggung jawab, cermat, disiplin, tidak menyalahgunakan wewenang.
     * Kompeten: Terus belajar, meningkatkan kapabilitas, melaksanakan tugas dengan kualitas terbaik.
     * Harmonis: Menghargai setiap orang apa pun latar belakangnya, suka menolong, lingkungan kerja kondusif.
     * Loyal: Memegang teguh ideologi Pancasila dan UUD 1945, setia kepada NKRI dan pemerintahan sah, menjaga rahasia jabatan.
     * Adaptif: Cepat menyesuaikan diri menghadapi perubahan, berinovasi, antusias menggerakkan perubahan.
     * Kolaboratif: Memberi kesempatan berbagai pihak berkontribusi, terbuka dalam kerja sama.
   - Jejaring Kerja, TIK, Sosial Budaya, Profesionalisme, dan Anti-Radikalisme.
   - PANTANGAN TKP: DILARANG KERAS menganggap opsi TKP sebagai "benar atau salah mutlak". Setiap opsi A-E memiliki nilai 1 sampai 5. Opsi dengan skor 5 selalu menunjukkan inisiatif solutif paling tinggi, ketenangan emosional, kepatuhan integritas, dan kepentingan publik tanpa membebankan pihak lain.

ATURAN SAAT MEMBERIKAN SOAL LATIHAN (MODE SOAL INTERAKTIF):
1. Berikan TEPAT 1 butir soal per giliran.
2. Format tampilan:
   ### 📝 Latihan Soal [TWK/TIU/TKP] — [Subtopik]
   [Narasi soal kasus/penalaran HOTS yang jelas dan realistis]
   
   A. [Pilihan A]
   B. [Pilihan B]
   C. [Pilihan C]
   D. [Pilihan D]
   E. [Pilihan E]

   Silakan ketik pilihan jawaban Anda (**A**, **B**, **C**, **D**, atau **E**)!
3. PANTANGAN MUTLAK: JANGAN PERNAH menampilkan Kunci Jawaban, Skor Tiap Pilihan, atau Pembahasan saat menyajikan soal baru! Beri kesempatan pengguna berpikir dan menjawab.
4. Di baris paling akhir respons (setelah kalimat ajakan menjawab), WAJIB menyertakan metadata JSON satu baris dengan format:
<quiz_meta>{"category":"TWK|TIU|TKP","subtopic":"...","questionStem":"...","options":{"A":"...","B":"...","C":"...","D":"...","E":"..."},"correctOption":"A|B|C|D|E","scoringRubric":{"A":number,"B":number,"C":number,"D":number,"E":number},"rubricRationale":"..."}</quiz_meta>
Untuk TWK dan TIU, correctOption memiliki skor 5, opsi lain skor 0. Untuk TKP, correctOption adalah opsi berbobot 5, dan scoringRubric wajib memuat bobot nilai 1 s.d. 5 untuk seluruh opsi A, B, C, D, E.

ATURAN SAAT MENGEVALUASI JAWABAN PENGGUNA (MODE PEMBAHASAN TERKUNCI):
1. Jika server menyediakan blok [EVALUASI KUIS TERKUNCI SERVER], gunakan kunci jawaban dan skor yang telah ditentukan secara mutlak.
2. Untuk TWK dan TIU:
   - Tampilkan Status Jawaban & Perolehan Skor: "Jawaban Anda: [A/B/C/D/E] ([BENAR +5 Poin / SALAH 0 Poin])"
   - Kunci Jawaban Tepat: [Opsi Benar]
   - Pembahasan Konsep / Materi / Rumus Mendalam
   - Analisis Pengecoh (mengapa opsi lain salah / kurang tepat)
   - 💡 Trik Cepat SKD
3. Untuk TKP:
   - Tampilkan Skor Jawaban: "Skor Anda: [1-5] / 5 Poin"
   - Opsi Terbaik (Skor 5): [Opsi Skor 5]
   - Rincian Skor Lengkap Opsi A s.d. E (5, 4, 3, 2, 1) beserta alasan indikator perilaku Core Values BerAKHLAK
   - 💡 Tips Menjawab TKP Serupa`;

const TURN2_SYSTEM_INSTRUCTION =
  'Anda adalah Tutor Ahli SKD CPNS BKN. Berikan analisis pengecoh ringkas dan trik cepat < 50 detik dalam bahasa Indonesia baku tanpa mengulang pembahasan resmi.';

const MAX_HISTORY_TURNS = 8;
const MAX_HISTORY_TURN_CHARS = 1600;
const MAX_HISTORY_TOTAL_CHARS = 9000;

function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`;
}

function cleanHistoricalText(text: string): string {
  if (!text) return '';
  const cleaned = text
    .replace(/<!--QUIZ_ATTEMPT:[\s\S]*?-->/g, '')
    .replace(/<!--QUIZ_EVAL:[\s\S]*?-->/g, '')
    .replace(/<!--CHAT_ERROR:[\s\S]*?-->/g, '')
    .replace(/<quiz_meta>[\s\S]*?<\/quiz_meta>/gi, '')
    .replace(/<quiz_meta>[\s\S]*$/gi, '')
    .trim();
  return truncateText(cleaned, MAX_HISTORY_TURN_CHARS);
}

export async function generateChatTitle(message: string): Promise<string> {
  if (!message || typeof message !== 'string') {
    return 'Sesi Belajar SKD';
  }

  let cleaned = message
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<quiz_meta>[\s\S]*?<\/quiz_meta>/gi, ' ')
    .replace(/<quiz_meta>[\s\S]*$/gi, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[`*_~#>]+/g, ' ')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const fillerPattern =
    /^(?:halo(?:\s+tutor)?|hai|permisi|selamat\s+(?:pagi|siang|sore|malam)|tolong|mohon|coba|bantu(?:\s+saya)?|bisa(?:\s+tolong)?|jelaskan(?:\s+tentang)?|kasih(?:\s+tahu)?|berikan(?:\s+saya)?|beri(?:\s+saya)?|minta|buatkan(?:\s+saya)?|tentang|mengenai)\b[,:.\s]*/i;
  for (let i = 0; i < 4; i++) {
    const next = cleaned.replace(fillerPattern, '').trim();
    if (next === cleaned) break;
    cleaned = next;
  }

  cleaned = cleaned.replace(/^[,.:;!?-]+|[,.:;!?-]+$/g, '').trim();
  if (!cleaned) {
    return 'Sesi Belajar SKD';
  }

  cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);

  if (cleaned.length > 45) {
    const sliced = cleaned.slice(0, 45);
    const lastSpace = sliced.lastIndexOf(' ');
    cleaned = (lastSpace > 15 ? sliced.slice(0, lastSpace) : sliced).trim();
    cleaned = cleaned.replace(/[,.:;!?-]+$/g, '').trim();
  }

  return cleaned || 'Sesi Belajar SKD';
}

export async function* generateAiResponse(
  userMessage: string,
  options?: GenerateAiResponseOptions
) {
  try {
    // 1. Fast deterministic path for verbatim benchmark question
    if (
      options?.ragResult?.isQuizRequest &&
      options?.ragResult?.unattemptedBenchmark &&
      !options?.lockedQuizEvaluation
    ) {
      const b = options.ragResult.unattemptedBenchmark;
      const benchmarkText = `### 📝 Latihan Soal ${b.category} — ${b.subtopic}

${b.questionStem}

A. ${b.options.A}
B. ${b.options.B}
C. ${b.options.C}
D. ${b.options.D}
E. ${b.options.E}

Silakan ketik pilihan jawaban Anda (**A**, **B**, **C**, **D**, atau **E**)!

<quiz_meta>${JSON.stringify(b)}</quiz_meta>`;

      yield benchmarkText;
      return;
    }

    // 2. Instant Turn-2 Locked Evaluation Streaming + 12s Timeout Guard
    if (options?.lockedQuizEvaluation) {
      const evalData = options.lockedQuizEvaluation;
      const subtest = evalData.subtest || evalData.category;
      evalData.subtest = subtest;
      const bestTkpOption =
        evalData.correctOption ??
        ((['A', 'B', 'C', 'D', 'E'] as const).find(
          (opt) => evalData.scoringRubric?.[opt] === 5
        ) ??
          null);
      if (typeof evalData.isCorrect !== 'boolean') {
        evalData.isCorrect =
          evalData.correctOption !== null
            ? evalData.userAnswer === evalData.correctOption
            : evalData.scoreEarned === evalData.maxScore;
      }
      const rationaleText = evalData.rubricRationale ?? '-';

      if (evalData.subtest === 'TKP') {
        const rubricLines = (['A', 'B', 'C', 'D', 'E'] as const).map((opt) => {
          const score =
            evalData.scoringRubric?.[opt] ??
            (opt === bestTkpOption ? 5 : 1);
          const isBest = opt === bestTkpOption || score === 5;
          const isSelected = opt === evalData.userAnswer;
          const badges: string[] = [];
          if (isBest) badges.push('⭐ (Skor Tertinggi)');
          if (isSelected) badges.push('👈 Pilihan Anda');
          const badgeStr = badges.length > 0 ? ` ${badges.join(' ')}` : '';
          const optText = evalData.options?.[opt]
            ? `: ${evalData.options[opt]}`
            : '';
          return `- **Opsi ${opt} (${score} Poin)**${badgeStr}${optText}`;
        });
        const rubricList = rubricLines.join('\n');

        const initialEvaluationChunk = `### 📊 Evaluasi Jawaban (TKP — ${evalData.subtopic})
- **Jawaban Anda:** Opsi **${evalData.userAnswer}**
- **Skor Diperoleh:** **+${evalData.scoreEarned} / 5 Poin**
- **Opsi Terbaik (5 Poin):** ${bestTkpOption ? `Opsi **${bestTkpOption}**` : '-'}

#### 📋 Rincian Skor Opsi A–E
${rubricList}

#### 💡 Pembahasan Resmi
${rationaleText}
`;
        yield initialEvaluationChunk;
      } else {
        const initialEvaluationChunk = `### ${evalData.isCorrect ? '✅ Jawaban Tepat!' : '❌ Jawaban Kurang Tepat'} (${evalData.subtest} — ${evalData.subtopic})
- **Jawaban Anda:** Opsi **${evalData.userAnswer}**
- **Kunci Jawaban:** ${evalData.correctOption ? `Opsi **${evalData.correctOption}**` : '-'}
- **Skor Diperoleh:** **+${evalData.scoreEarned} / 5 Poin**

#### 💡 Pembahasan Resmi
${rationaleText}
`;
        yield initialEvaluationChunk;
      }

      // Supplementary AI Trick & Eliminasi Stream (with 12_000 ms timeout and resilience)
      try {
        const ai = getGenAIClient();
        const model = getGenerativeModel();
        const isGemini25 = model.startsWith('gemini-2.5');
        const officialAnswerLabel = evalData.correctOption
          ? `Opsi ${evalData.correctOption}`
          : bestTkpOption
            ? `Opsi ${bestTkpOption}`
            : 'Lihat rubrik skor';

        const suppPrompt = `Soal SKD (${evalData.subtest} — ${evalData.subtopic}):
${evalData.questionStem}

Pilihan Jawaban:
A. ${evalData.options.A}
B. ${evalData.options.B}
C. ${evalData.options.C}
D. ${evalData.options.D}
E. ${evalData.options.E}

Kunci Jawaban Resmi: ${officialAnswerLabel}
Jawaban Pengguna: Opsi ${evalData.userAnswer}
Pembahasan Resmi:
${rationaleText}

Tugas:
Buat HANYA bagian tambahan berikut:
#### ⚡ Trik Cepat (< 50 Detik) & Analisis Pengecoh

Ketentuan:
1. JANGAN mengulang judul evaluasi, skor, status benar/salah, rincian opsi, atau pembahasan resmi di atas karena sudah ditampilkan ke pengguna.
2. Berikan trik cepat SKD (< 50 detik) dan analisis ringkas mengapa opsi pengecoh lain kurang tepat atau mengecoh.
3. Langsung mulai respons dari header "#### ⚡ Trik Cepat (< 50 Detik) & Analisis Pengecoh".`;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const suppConfig: any = {
          systemInstruction: TURN2_SYSTEM_INSTRUCTION,
          temperature: 0.35,
          maxOutputTokens: 768,
          abortSignal: AbortSignal.timeout(12_000),
          ...(isGemini25 ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        };

        let hasYieldedPrefix = false;
        for await (const text of streamGeminiWithCascade({
          ai,
          contents: suppPrompt,
          config: suppConfig,
        })) {
          if (!hasYieldedPrefix) {
            yield '\n';
            hasYieldedPrefix = true;
          }
          yield text;
        }
      } catch (suppError) {
        console.warn(
          'Turn-2 supplementary Gemini stream skipped/timed out:',
          suppError
        );
        return;
      }

      return;
    }

    const ai = getGenAIClient();

    // 3. Build multi-turn history cleaned of internal markers and bounded by turns & total chars
    const historyContents: {
      role: 'user' | 'model';
      parts: { text: string }[];
    }[] = [];

    const rawHistory = options?.history || [];
    const recentHistory = rawHistory.slice(-MAX_HISTORY_TURNS);

    for (const turn of recentHistory) {
      const role: 'user' | 'model' = turn.role === 'user' ? 'user' : 'model';
      const cleanedText = cleanHistoricalText(turn.content);
      if (!cleanedText) continue;

      if (
        historyContents.length > 0 &&
        historyContents[historyContents.length - 1].role === role
      ) {
        historyContents[historyContents.length - 1].parts[0].text = truncateText(
          `${historyContents[historyContents.length - 1].parts[0].text}\n\n${cleanedText}`,
          MAX_HISTORY_TURN_CHARS
        );
      } else {
        historyContents.push({
          role,
          parts: [{ text: cleanedText }],
        });
      }
    }

    let totalHistoryChars = historyContents.reduce(
      (sum, item) => sum + item.parts[0].text.length,
      0
    );
    while (totalHistoryChars > MAX_HISTORY_TOTAL_CHARS && historyContents.length > 0) {
      const removed = historyContents.shift();
      totalHistoryChars -= removed ? removed.parts[0].text.length : 0;
    }

    // 4. Compose current user prompt with deterministic or RAG context
    let finalUserPrompt = userMessage;

    if (options?.deepTutorContext) {
      finalUserPrompt = buildDeepTutorPrompt(
        userMessage,
        options.deepTutorContext
      );
    } else if (options?.ragResult?.isQuizRequest) {
      finalUserPrompt = `${userMessage}

[INSTRUKSI MODE SOAL INTERAKTIF]
Pengguna meminta soal latihan SKD.
Kategori: ${options.ragResult.detectedCategory || 'SKD'}
${
  options.ragResult.formattedContext
    ? `\nKonteks RAG Kisi-kisi & Contoh Soal:\n${options.ragResult.formattedContext}`
    : ''
}

ATURAN WAJIB:
1. Buatkan TEPAT 1 soal latihan baru berkualitas tinggi (HOTS).
2. Tampilkan: Judul soal, narasi soal, dan opsi A sampai E (masing-masing di baris baru).
3. Minta pengguna menjawab (A, B, C, D, atau E).
4. DILARANG KERAS MEMBOCORKAN KUNCI JAWABAN ATAU PEMBAHASAN SEKARANG!
5. Pada akhir respons, lampirkan blok:
<quiz_meta>{"category":"${
        options.ragResult.detectedCategory || 'TWK'
      }","subtopic":"...","questionStem":"...","options":{"A":"...","B":"...","C":"...","D":"...","E":"..."},"correctOption":"...","scoringRubric":{"A":...,"B":...,"C":...,"D":...,"E":...},"rubricRationale":"..."}</quiz_meta>`;
    } else if (options?.ragResult?.formattedContext) {
      finalUserPrompt = `${userMessage}\n\n[REFERENSI KURIKULUM & KISI-KISI RESMI SKD]\n${options.ragResult.formattedContext}`;
    }

    // Ensure alternating user/model turns before appending the user turn
    if (
      historyContents.length > 0 &&
      historyContents[historyContents.length - 1].role === 'user'
    ) {
      historyContents.push({
        role: 'model',
        parts: [{ text: 'Siap, saya siap membantu.' }],
      });
    }

    historyContents.push({
      role: 'user',
      parts: [{ text: finalUserPrompt }],
    });

    // 5. Decide tools (Google Search only when explicitly enabled + temporal intent)
    const enableGoogleSearch =
      !options?.deepTutorContext &&
      !options?.ragResult?.unattemptedBenchmark &&
      shouldEnableGoogleSearch(userMessage);

    const envBudget = process.env.GEMINI_THINKING_BUDGET?.trim();
    const rawBudget = envBudget ? Number(envBudget) : 256;
    const thinkingBudget =
      Number.isFinite(rawBudget) && rawBudget >= 0 ? rawBudget : 256;

    const model = getGenerativeModel();
    const isGemini25 = model.startsWith('gemini-2.5');

    // Note: thinkingConfig.thinkingBudget applies only to gemini-2.5-* models.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config: any = {
      systemInstruction: SKD_SYSTEM_INSTRUCTION,
      temperature: 0.35,
      maxOutputTokens: 4096,
      ...(isGemini25 ? { thinkingConfig: { thinkingBudget } } : {}),
      ...(enableGoogleSearch ? { tools: [{ googleSearch: {} }] } : {}),
    };

    for await (const text of streamGeminiWithCascade({
      ai,
      contents: historyContents,
      config,
      isQuizRequest: Boolean(options?.ragResult?.isQuizRequest),
    })) {
      yield text;
    }
  } catch (error) {
    console.error('AI generation error:', error);
    throw error;
  }
}

export function extractQuizMetaFromText(rawText: string): {
  visibleText: string;
  quizMeta: SkdQuizMetadata | null;
} {
  if (!rawText) {
    return { visibleText: '', quizMeta: null };
  }

  let quizMeta: SkdQuizMetadata | null = null;
  const metaRegex = /<quiz_meta>([\s\S]*?)<\/quiz_meta>/i;
  const match = rawText.match(metaRegex);

  if (match && match[1]) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (
        parsed &&
        typeof parsed === 'object' &&
        ['TWK', 'TIU', 'TKP'].includes(parsed.category) &&
        typeof parsed.questionStem === 'string' &&
        parsed.options &&
        typeof parsed.options === 'object' &&
        parsed.options.A &&
        parsed.options.B &&
        parsed.options.C &&
        parsed.options.D &&
        parsed.options.E &&
        ['A', 'B', 'C', 'D', 'E'].includes(parsed.correctOption) &&
        parsed.scoringRubric &&
        typeof parsed.scoringRubric === 'object'
      ) {
        const isTkp = parsed.category === 'TKP';
        const rubricA = Number(parsed.scoringRubric.A ?? 0);
        const rubricB = Number(parsed.scoringRubric.B ?? 0);
        const rubricC = Number(parsed.scoringRubric.C ?? 0);
        const rubricD = Number(parsed.scoringRubric.D ?? 0);
        const rubricE = Number(parsed.scoringRubric.E ?? 0);

        const scoringRubric = isTkp
          ? {
              A:
                Number.isFinite(rubricA) && rubricA >= 0 && rubricA <= 5
                  ? rubricA
                  : 1,
              B:
                Number.isFinite(rubricB) && rubricB >= 0 && rubricB <= 5
                  ? rubricB
                  : 1,
              C:
                Number.isFinite(rubricC) && rubricC >= 0 && rubricC <= 5
                  ? rubricC
                  : 1,
              D:
                Number.isFinite(rubricD) && rubricD >= 0 && rubricD <= 5
                  ? rubricD
                  : 1,
              E:
                Number.isFinite(rubricE) && rubricE >= 0 && rubricE <= 5
                  ? rubricE
                  : 1,
            }
          : {
              A: parsed.correctOption === 'A' ? 5 : 0,
              B: parsed.correctOption === 'B' ? 5 : 0,
              C: parsed.correctOption === 'C' ? 5 : 0,
              D: parsed.correctOption === 'D' ? 5 : 0,
              E: parsed.correctOption === 'E' ? 5 : 0,
            };

        if (isTkp) {
          const sorted = Object.values(scoringRubric).sort((a, b) => a - b);
          const isPermutation = sorted.join(',') === '1,2,3,4,5';
          if (
            isPermutation &&
            scoringRubric[
              parsed.correctOption as 'A' | 'B' | 'C' | 'D' | 'E'
            ] === 5
          ) {
            quizMeta = {
              ragSourceId: parsed.ragSourceId,
              category: parsed.category,
              subtopic: parsed.subtopic || 'Umum',
              questionStem: parsed.questionStem,
              options: {
                A: String(parsed.options.A),
                B: String(parsed.options.B),
                C: String(parsed.options.C),
                D: String(parsed.options.D),
                E: String(parsed.options.E),
              },
              correctOption: parsed.correctOption,
              scoringRubric,
              rubricRationale: parsed.rubricRationale || '',
            };
          }
        } else {
          quizMeta = {
            ragSourceId: parsed.ragSourceId,
            category: parsed.category,
            subtopic: parsed.subtopic || 'Umum',
            questionStem: parsed.questionStem,
            options: {
              A: String(parsed.options.A),
              B: String(parsed.options.B),
              C: String(parsed.options.C),
              D: String(parsed.options.D),
              E: String(parsed.options.E),
            },
            correctOption: parsed.correctOption,
            scoringRubric,
            rubricRationale: parsed.rubricRationale || '',
          };
        }
      }
    } catch (e) {
      console.warn(
        '[extractQuizMetaFromText] Failed to parse JSON quiz_meta:',
        e
      );
    }
  }

  // Strip <quiz_meta>...</quiz_meta> and any unclosed trailing <quiz_meta>...
  let visibleText = rawText.replace(/<quiz_meta>[\s\S]*?<\/quiz_meta>/gi, '');
  visibleText = visibleText.replace(/<quiz_meta>[\s\S]*$/gi, '');
  visibleText = visibleText.trim();

  return { visibleText, quizMeta };
}
