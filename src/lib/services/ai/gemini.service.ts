import { GoogleGenAI } from '@google/genai';
import { SkdRetrievalResult, SkdQuizMetadata } from './rag.service';

export interface ChatHistoryTurn {
  role: 'user' | 'bot' | 'model';
  content: string;
}

export interface LockedQuizEvaluation {
  quizId: string;
  category: 'TWK' | 'TIU' | 'TKP';
  subtopic: string;
  questionStem: string;
  options: { A: string; B: string; C: string; D: string; E: string };
  correctOption: 'A' | 'B' | 'C' | 'D' | 'E';
  scoringRubric: { A: number; B: number; C: number; D: number; E: number };
  rubricRationale: string;
  userAnswer: 'A' | 'B' | 'C' | 'D' | 'E';
  scoreEarned: number;
  maxScore: number;
}

export interface GenerateAiResponseOptions {
  history?: ChatHistoryTurn[];
  ragResult?: SkdRetrievalResult;
  lockedQuizEvaluation?: LockedQuizEvaluation;
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

function cleanHistoricalText(text: string): string {
  if (!text) return '';
  return text
    .replace(/<!--QUIZ_ATTEMPT:[\s\S]*?-->/g, '')
    .replace(/<!--QUIZ_EVAL:[\s\S]*?-->/g, '')
    .replace(/<quiz_meta>[\s\S]*?<\/quiz_meta>/gi, '')
    .replace(/<quiz_meta>[\s\S]*$/gi, '')
    .trim();
}

export async function generateChatTitle(message: string): Promise<string> {
  try {
    const ai = getGenAIClient();
    const result = await ai.models.generateContent({
      model: getGenerativeModel(),
      contents: `Generate a short, descriptive title in Indonesian (max 40 characters) for an SKD learning chat that starts with: "${message}". Return only the title text without quotes.`,
      config: {
        thinkingConfig: {
          thinkingBudget: 0,
        },
        maxOutputTokens: 64,
      },
    });
    const title = result.text?.trim() || 'Sesi Belajar SKD';
    return title.length > 50 ? title.substring(0, 47) + '...' : title;
  } catch (error) {
    console.error('Title generation error:', error);
    return 'Sesi Belajar SKD';
  }
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

    const ai = getGenAIClient();

    // 2. Build multi-turn history cleaned of internal markers
    const historyContents: {
      role: 'user' | 'model';
      parts: { text: string }[];
    }[] = [];

    const rawHistory = options?.history || [];
    const recentHistory = rawHistory.slice(-16);

    for (const turn of recentHistory) {
      const role: 'user' | 'model' = turn.role === 'user' ? 'user' : 'model';
      const cleanedText = cleanHistoricalText(turn.content);
      if (!cleanedText) continue;

      if (
        historyContents.length > 0 &&
        historyContents[historyContents.length - 1].role === role
      ) {
        historyContents[historyContents.length - 1].parts[0].text +=
          `\n\n${cleanedText}`;
      } else {
        historyContents.push({
          role,
          parts: [{ text: cleanedText }],
        });
      }
    }

    // 3. Compose current user prompt with locked evaluation or RAG context
    let finalUserPrompt = userMessage;

    if (options?.lockedQuizEvaluation) {
      const evalData = options.lockedQuizEvaluation;
      finalUserPrompt = `${userMessage}

[EVALUASI KUIS TERKUNCI SERVER]
Kategori: ${evalData.category}
Subtopik: ${evalData.subtopic}
Soal:
${evalData.questionStem}

Pilihan Jawaban:
A. ${evalData.options.A}
B. ${evalData.options.B}
C. ${evalData.options.C}
D. ${evalData.options.D}
E. ${evalData.options.E}

Jawaban Pengguna: ${evalData.userAnswer}
Kunci Jawaban Resmi: ${evalData.correctOption}
Skor Diperoleh: ${evalData.scoreEarned} / ${evalData.maxScore} Poin
Rubrik Skor: A=${evalData.scoringRubric.A}, B=${evalData.scoringRubric.B}, C=${evalData.scoringRubric.C}, D=${evalData.scoringRubric.D}, E=${evalData.scoringRubric.E}
Rasional Rubrik Resmi: ${evalData.rubricRationale}

Instruksi: Berikan evaluasi dan pembahasan lengkap sesuai format resmi SKD. Kunci jawaban dan skor di atas sudah TERKUNCI oleh server dan tidak boleh diubah.`;
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

    // 4. Decide tools (Google Search only when needed and not in locked evaluation or benchmark)
    const enableGoogleSearch =
      !options?.lockedQuizEvaluation &&
      !options?.ragResult?.unattemptedBenchmark &&
      (options?.ragResult?.wantsNewVariation ||
        /ikn|terkini|terbaru|kebijakan|pemerintah|berita/i.test(userMessage));

    const envBudget = process.env.GEMINI_THINKING_BUDGET?.trim();
    const rawBudget = envBudget ? Number(envBudget) : 512;
    const thinkingBudget = options?.lockedQuizEvaluation
      ? 0
      : Number.isFinite(rawBudget) && rawBudget >= 0
        ? rawBudget
        : 512;

    // Note: thinkingConfig.thinkingBudget applies to gemini-2.5-* models; revisit if
    // GENERATIVE_MODEL changes to a model with a different thinking parameter.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config: any = {
      systemInstruction: SKD_SYSTEM_INSTRUCTION,
      temperature: 0.35,
      maxOutputTokens: 4096,
      thinkingConfig: {
        thinkingBudget,
      },
      ...(enableGoogleSearch ? { tools: [{ googleSearch: {} }] } : {}),
    };

    const response = await ai.models.generateContentStream({
      model: getGenerativeModel(),
      contents: historyContents,
      config,
    });

    for await (const chunk of response) {
      // Filter out thought tokens
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parts = (chunk as any).candidates?.[0]?.content?.parts;
      if (Array.isArray(parts) && parts.length > 0) {
        let text = '';
        for (const part of parts) {
          if (part && !part.thought && typeof part.text === 'string') {
            text += part.text;
          }
        }
        if (text) {
          yield text;
        }
      } else if (chunk.text) {
        yield chunk.text;
      }
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
