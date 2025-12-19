# Walkthrough: Membuat Chatbot Tutor SKD CPNS dengan Kemampuan Web Search

Dokumen ini berisi panduan langkah-demi-langkah untuk mengembangkan fitur chatbot yang dapat mencari soal SKD terbaru dan informasi terkini dari internet.

## 🎯 Tujuan
Membuat chatbot yang bisa:
1.  Mencari soal SKD terbaru di internet (TWK, TIU, TKP).
2.  Memvalidasi informasi dengan sumber terkini (berita, peraturan baru).
3.  Memberikan pembahasan soal secara interaktif dan faktual.

---

## 🛠️ Tools & Tech Stack

1.  **LLM Framework**
    *   **Library:** `@google/genai` (Google Gemini SDK)
    *   *Fitur:* Menggunakan **Google Search Tool** bawaan Gemini 2.0 untuk pencarian web otomatis.
    *   *Fitur:* Menggunakan **Thinking Mode** untuk penalaran langkah demi langkah sebelum menjawab.

---

## 📅 Estimasi Jam Kerja

Total estimasi waktu: **2 - 3 Jam**

| Tahap | Tugas | Estimasi Waktu |
| :--- | :--- | :--- |
| **1. Persiapan** | Setup Environment Variable (Gemini API Key) | 15 Menit |
| **2. Backend Service** | Update `gemini.service.ts` (Streaming & Thinking) | 1 Jam |
| **3. Frontend** | Update UI untuk menampilkan "Thinking Process" | 1 Jam |
| **4. Testing** | Uji coba soal & validasi jawaban | 30 Menit |

---

## 🚀 Langkah Implementasi

### Langkah 1: Setup Environment Variable
Pastikan API Key Gemini sudah ada di `.env`.

```env
GEMINI_API_KEY=AIzaSy...
GENERATIVE_MODEL=gemini-2.0-flash-thinking-exp-1219
```

### Langkah 2: Update Service AI (Streaming & Thinking)
Modifikasi `src/lib/services/ai/gemini.service.ts` untuk menggunakan `generateContentStream` dengan konfigurasi `thinkingConfig`.

```typescript
// src/lib/services/ai/gemini.service.ts
// ... (kode implementasi streaming)
```

### Langkah 3: Update Frontend (UI Thinking)
Modifikasi komponen chat untuk menangani stream data yang berisi bagian "thought" (pemikiran) dan "answer" (jawaban).

1.  Update `useChat` hook untuk parsing stream.
2.  Buat komponen UI (misal: Accordion) untuk menyembunyikan/menampilkan proses berpikir AI.

---

## 📝 Catatan Penting
- **Tavily & Cheerio:** Tidak lagi diperlukan karena kita menggunakan *native Google Search tool* dari Gemini 2.0.
- **Model:** Pastikan menggunakan model yang mendukung *thinking mode* (seperti `gemini-2.0-flash-thinking-exp`).
