import { ApiError } from "@/middleware/api";
import { GoogleGenAI } from "@google/genai";

const apiKey: string = process.env.GEMINI_API_KEY || "";
const generativeModel: string =
  process.env.GENERATIVE_MODEL || "gemini-2.5-flash-lite";

if (!apiKey) {
  console.error("Missing GEMINI_API_KEY");
  throw new ApiError(
    "Tidak dapat memproses respon chatbot, silahkan hubungi admin.",
    500,
    "API_CONFIG_ERROR"
  );
}

const genAI = new GoogleGenAI({ apiKey });

export async function generateChatTitle(message: string): Promise<string> {
  try {
    const result = await genAI.models.generateContent({
      model: generativeModel,
      contents: `Generate a short, descriptive title (max 50 characters) for a chat that starts with: "${message}". Return only the title.`,
    });
    const title = result.text?.trim() || "New Chat";
    return title.length > 50 ? title.substring(0, 47) + "..." : title;
  } catch (error) {
    console.error("Title generation error:", error);
    return "New Chat";
  }
}

export async function* generateAiResponse(userMessage: string) {
  try {
    const systemPrompt = `
Kamu adalah Tutor SKD CPNS yang ahli, ramah, dan up-to-date. Tugasmu adalah membantu pengguna berlatih soal-soal SKD (TWK, TIU, TKP) dengan penjelasan yang komprehensif dan mudah dipahami.

ATURAN FORMATTING (WAJIB DIPATUHI):
1. Gunakan format Markdown yang rapi.
2. Jika memberikan soal pilihan ganda, setiap pilihan (a, b, c, d, e) HARUS berada di baris baru (newline).
3. Gunakan **bold** untuk penekanan pada kata kunci atau jawaban yang benar.
4. Pisahkan antara Soal, Pilihan Jawaban, dan Pembahasan dengan baris kosong agar mudah dibaca.
5. Gunakan list (bullet points) atau penomoran untuk menjelaskan poin-poin penting.

ATURAN KONTEN:
- Pastikan jawaban sesuai dengan kurikulum SKD CPNS terbaru, GUNAKAN tool googleSearch() untuk mencari referensi valid, dan JANGAN mengarang jawaban.
- Jika pengguna meminta soal 'terbaru' atau bertanya tentang isu terkini (seperti IKN, kebijakan pemerintah baru).
- Berikan pembahasan yang mendalam, bukan hanya kunci jawaban. Jelaskan MENGAPA jawaban tersebut benar dan mengapa pilihan lain salah.
- Sertakan sumber informasi jika kamu mengambil data dari internet.
`;

    const augmentedPrompt = `${systemPrompt}\nPERTANYAAN PENGGUNA: "${userMessage}"\nJAWABAN ANDA:`;

    const response = await genAI.models.generateContentStream({
      model: generativeModel,
      contents: augmentedPrompt,
      config: {
        maxOutputTokens: 5120,
        thinkingConfig: {
          includeThoughts: true,
        },
        tools: [{ googleSearch: {} }],
      },
    });

    for await (const chunk of response) {
      if (chunk.text) {
        yield chunk.text;
      }
    }
  } catch (error) {
    console.error("AI generation error:", error);
    yield "Maaf, terjadi kesalahan dalam memproses pertanyaan Anda. Silakan coba lagi.";
  }
}
