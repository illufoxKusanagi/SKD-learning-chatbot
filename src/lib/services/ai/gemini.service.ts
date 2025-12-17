import { GoogleGenAI } from "@google/genai";

// The client gets the API key from the environment variable `GEMINI_API_KEY`.
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function getGeminiResponse(message: string): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.0-flash",
      contents: message,
    });
    return response.text ?? "No content generated";
  } catch (error) {
    console.error("Error generating content:", error);
    throw new Error("Failed to generate content from Gemini AI");
  }
}
