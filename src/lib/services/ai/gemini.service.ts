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

// Note: Image generation tools have been removed as per user request.
// We now focus purely on high-quality text generation with visible thinking process.

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

INSTRUKSI INTEGRASI FORMAT:
1.  **Thinking Process**: Setiap kali menjawab, MULAI dengan proses berpikir langkah demi langkah yang dibungkus tag <thinking>...</thinking>. Ini wajib.
2.  **Konten**: Fokus pada teks berkualitas tinggi. Gunakan analogi dan penjelasan logis.

ATURAN FORMATTING (WAJIB DIPATUHI):
-   Gunakan format Markdown.
-   Soal pilihan ganda harus setiap pilihan di baris baru.
-   Pisahkan bagian Soal, Pilihan, dan Pembahasan.
`;

    // Prompt Engineering
    const augmentedPrompt = `${systemPrompt}\nPERTANYAAN PENGGUNA: "${userMessage}"\nJAWABAN ANDA:`;

    // Configuration:
    // We intentionally DISABLE 'thinkingConfig' api-level if it conflicts with tools.
    // Instead, we prompted for <thinking> tags in the system prompt above.
    const response = await genAI.models.generateContentStream({
      model: generativeModel,
      contents: augmentedPrompt,
      config: {
        maxOutputTokens: 5120,
        // Tools removed as per request
      },
    });

    for await (const chunk of response) {
      // 1. Handle Text Stream (With Transformations)
      const parts = chunk.candidates?.[0]?.content?.parts;

      let textChunk = "";
      if (parts) {
        textChunk = parts.map((p) => p.text).join("");
      } else if (chunk.text) {
        textChunk = chunk.text;
      }

      if (textChunk) {
        // TRANSFORM: Convert <thinking> XML tags to HTML Details/Summary for Collapsible UI.
        // This relies on the frontend Markdown renderer supporting raw HTML (e.g. rehype-raw).
        // <details> is a standard HTML5 tag for creating collapsible widgets.

        // Note: Regex replacement on streams is tricky if the tag is split across chunks.
        // However, specifically for the <thinking> tag which usually appears at the start,
        // simple replacement often works "good enough" for the opening tag.

        let formattedText = textChunk;

        // Replace opening tag with <details><summary>...
        formattedText = formattedText.replace(
          /<thinking>/g,
          "\n<details>\n<summary>Thinking Process (Click to Expand)</summary>\n\n"
        );

        // Replace closing tag with </details>
        formattedText = formattedText.replace(
          /<\/thinking>/g,
          "\n</details>\n\n"
        );

        yield formattedText;
      }
    }
  } catch (error) {
    console.error("AI generation error:", error);
    yield "Maaf, terjadi kesalahan dalam memproses pertanyaan Anda. Silakan coba lagi.";
  }
}
