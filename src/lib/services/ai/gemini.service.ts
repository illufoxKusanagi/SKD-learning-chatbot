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

export async function generateAiResponse(userMessage: string) {
  try {
    let answer = "";
    let thoughts = "";
    const systemPrompt = `
"Kamu adalah Tutor SKD CPNS yang ahli dan up-to-date. Tugasmu adalah membantu pengguna berlatih soal-soal SKD (TWK, TIU, TKP).

ATURAN PENTING:

- Jika pengguna meminta soal 'terbaru' atau bertanya tentang isu terkini (seperti IKN, kebijakan pemerintah baru), JANGAN mengarang jawaban. GUNAKAN tool googleSearch() untuk mencari referensi valid.
- Berikan pembahasan yang jelas dan mendidik.
- Sertakan sumber informasi jika kamu mengambil data dari internet."
`;

    const augmentedPrompt = `${systemPrompt}\nPERTANYAAN PENGGUNA: "${userMessage}"\nJAWABAN ANDA:`;

    const response = await genAI.models.generateContentStream({
      model: generativeModel,
      contents: augmentedPrompt,
      config: {
        thinkingConfig: {
          includeThoughts: true,
        },
        tools: [{ googleSearch: {} }],
      },
    });

    for await (const chunk of response) {
      const candidates = chunk.candidates;
      if (!candidates || candidates.length === 0) continue;

      const content = candidates[0].content;
      if (!content || !content.parts) continue;

      for (const part of content.parts) {
        if (!part.text) {
          continue;
        } else if (part.thought) {
          if (!thoughts) {
            console.log("Thoughts summary:");
          }
          console.log(part.text);
          thoughts = thoughts + part.text;
        } else {
          if (!answer) {
            console.log("Answer:");
          }
          console.log(part.text);
          answer = answer + part.text;
        }
      }
    }

    return answer || "Maaf, tidak dapat memproses permintaan Anda saat ini.";
  } catch (error) {
    console.error("AI generation error:", error);
    return "Maaf, terjadi kesalahan dalam memproses pertanyaan Anda. Silakan coba lagi.";
  }
}
