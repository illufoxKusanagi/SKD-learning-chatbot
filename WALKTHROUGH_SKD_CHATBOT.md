# Walkthrough: Membuat Chatbot Tutor SKD CPNS dengan Kemampuan Web Search

Dokumen ini berisi panduan langkah-demi-langkah untuk mengembangkan fitur chatbot yang dapat mencari soal SKD terbaru dan informasi terkini dari internet.

## 🎯 Tujuan
Membuat chatbot yang bisa:
1.  Mencari soal SKD terbaru di internet (TWK, TIU, TKP).
2.  Memvalidasi informasi dengan sumber terkini (berita, peraturan baru).
3.  Memberikan pembahasan soal secara interaktif dan faktual.

---

## 🛠️ Tools & Tech Stack

1.  **Search Engine API (Wajib)**
    *   **Tool:** **Tavily AI**
    *   *Fungsi:* Melakukan pencarian web yang dioptimalkan untuk LLM (hasil bersih, minim iklan).
    *   *Persiapan:* Daftar di [tavily.com](https://tavily.com) untuk mendapatkan API Key.

2.  **Web Scraper (Opsional)**
    *   **Library:** `cheerio`
    *   *Fungsi:* Mengambil detail konten dari halaman web tertentu jika ringkasan dari search engine kurang lengkap.

3.  **LLM Framework**
    *   **Library:** `@google/genai` (Google Gemini SDK)
    *   *Fitur:* Menggunakan **Function Calling** agar AI bisa memanggil tool pencarian secara otomatis.

---

## 📅 Estimasi Jam Kerja

Total estimasi waktu: **4 - 6 Jam**

| Tahap | Tugas | Estimasi Waktu |
| :--- | :--- | :--- |
| **1. Persiapan** | Daftar API Key (Tavily) & Setup Environment | 30 Menit |
| **2. Backend Service** | Membuat `search.service.ts` (Logika pencarian) | 1 Jam |
| **3. Integrasi AI** | Update `route.ts` untuk *Function Calling* | 2 Jam |
| **4. Prompting** | Menyusun System Prompt "Tutor SKD" | 30 Menit |
| **5. Testing** | Uji coba soal & validasi jawaban | 1 Jam |

---

## 🚀 Langkah Implementasi

### Langkah 1: Install Library
Install library yang dibutuhkan untuk koneksi ke Tavily dan scraping ringan.

```bash
npm install @tavily/core cheerio
```

### Langkah 2: Setup Environment Variable
Tambahkan API Key Tavily ke file `.env`.

```env
TAVILY_API_KEY=tvly-xxxxxxxxxxxxxxxxx
```

### Langkah 3: Membuat Service Pencarian
Buat file baru di `src/lib/services/ai/search.service.ts`.

```typescript
// src/lib/services/ai/search.service.ts
import { tavily } from "@tavily/core";

const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });

export async function searchWeb(query: string) {
  try {
    console.log(`[Search Service] Searching for: ${query}`);
    const response = await tvly.search(query, {
      search_depth: "basic", // atau "advanced" untuk hasil lebih dalam
      max_results: 5,
      include_answer: true,
    });
    
    return {
      results: response.results.map(r => ({
        title: r.title,
        url: r.url,
        content: r.content
      })),
      answer: response.answer // Ringkasan langsung dari Tavily
    };
  } catch (error) {
    console.error("Search failed:", error);
    return null;
  }
}
```

### Langkah 4: Update Route Handler (Function Calling)
Modifikasi `src/app/api/chat/route.ts` untuk mendaftarkan tool pencarian ke Gemini.

```typescript
// Snippet untuk src/app/api/chat/route.ts

// 1. Definisikan Tool
const searchTool = {
  functionDeclarations: [
    {
      name: "search_web",
      description: "Cari informasi terbaru, soal SKD, atau berita terkini di internet.",
      parameters: {
        type: "OBJECT",
        properties: {
          query: {
            type: "STRING",
            description: "Kata kunci pencarian yang spesifik (contoh: 'soal SKD TWK IKN terbaru')",
          },
        },
        required: ["query"],
      },
    },
  ],
};

// 2. Inisialisasi Model dengan Tools
const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash", // Gunakan model yang support function calling dengan baik
  tools: [searchTool],
});

// 3. Handle Chat & Function Call
// (Di dalam POST handler)
const chat = model.startChat({
  history: history, // History chat sebelumnya
});

const result = await chat.sendMessage(userMessage);
const call = result.response.functionCalls()?.[0];

if (call) {
  if (call.name === "search_web") {
    const apiResponse = await searchWeb(call.args.query);
    
    // Kirim hasil pencarian kembali ke model
    const result2 = await chat.sendMessage([
      {
        functionResponse: {
          name: "search_web",
          response: { result: apiResponse },
        },
      },
    ]);
    
    return NextResponse.json({ response: result2.response.text() });
  }
}

// Return jawaban normal jika tidak ada function call
return NextResponse.json({ response: result.response.text() });
```

### Langkah 5: System Prompt (Persona)
Tambahkan instruksi ini ke dalam inisialisasi chat atau system instruction model.

> "Kamu adalah Tutor SKD CPNS yang ahli dan up-to-date. Tugasmu adalah membantu pengguna berlatih soal-soal SKD (TWK, TIU, TKP).
>
> ATURAN PENTING:
> 1. Jika pengguna meminta soal 'terbaru' atau bertanya tentang isu terkini (seperti IKN, kebijakan pemerintah baru), JANGAN mengarang jawaban. GUNAKAN tool `search_web` untuk mencari referensi valid.
> 2. Berikan pembahasan yang jelas dan mendidik.
> 3. Sertakan sumber informasi jika kamu mengambil data dari internet."
