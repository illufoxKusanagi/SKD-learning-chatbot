<div align="center">

# RAG Portal Informasi Publik Kabupaten Madiun

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-316192?style=for-the-badge&logo=postgresql)](https://www.postgresql.org/)
[![Google AI](https://img.shields.io/badge/Google_AI-Gemini-4285F4?style=for-the-badge&logo=google)](https://ai.google.dev/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

**Sistem chatbot cerdas berbasis teknologi RAG (Retrieval-Augmented Generation) untuk layanan informasi publik Kabupaten Madiun**

[Fitur](#-fitur) • [Demo](#-demo) • [Instalasi](#-instalasi) • [Penggunaan](#-penggunaan) • [Panduan Developer](#-panduan-developer) • [Kontribusi](#-kontribusi)

[🇬🇧 Read in English](README.md)

</div>

---

## 📋 Daftar Isi

- [Tentang](#-tentang)
- [Fitur](#-fitur)
- [Teknologi](#-teknologi)
- [Prasyarat](#-prasyarat)
- [Instalasi](#-instalasi)
- [Penggunaan](#-penggunaan)
  - [Untuk Pengguna](#untuk-pengguna)
  - [Untuk Developer](#untuk-developer)
- [Panduan Developer](#-panduan-developer)
- [Dokumentasi API](#-dokumentasi-api)
- [Skema Database](#-skema-database)
- [Environment Variables](#-environment-variables)
- [Deployment](#-deployment)
- [Kontribusi](#-kontribusi)
- [Lisensi](#-lisensi)
- [Kontak](#-kontak)

---

## 📖 Tentang

RAG Portal Informasi Publik adalah sistem chatbot berbasis AI yang dirancang untuk memberikan akses cepat dan akurat terhadap informasi publik Kabupaten Madiun. Menggunakan teknologi RAG (Retrieval-Augmented Generation) yang canggih, sistem ini mengambil informasi relevan dari database yang telah dikurasi dan menghasilkan respons kontekstual menggunakan model AI Google Gemini.

### Keunggulan Utama

- 🎯 **Informasi Akurat**: Respons AI berdasarkan data pemerintah yang terverifikasi
- 🔍 **Pencarian Cerdas**: Pencarian semantik berbasis vektor dengan pgvector
- 🌐 **Dukungan Dwibahasa**: Utamanya Bahasa Indonesia dengan deteksi bahasa otomatis
- 🔐 **Autentikasi Pengguna**: Login opsional untuk menyimpan riwayat chat
- 📱 **Desain Responsif**: Bekerja sempurna di desktop dan mobile
- ⚡ **Respons Real-time**: Jawaban cepat dan efisien dari AI

---

## ✨ Fitur

### Untuk Pengguna Akhir

- **💬 Chatbot Cerdas**
  - Tanyakan apapun tentang Kabupaten Madiun dengan bahasa natural
  - Dapatkan jawaban akurat dari data pejabat, regulasi, dan layanan publik
  - Respons kontekstual menggunakan teknologi RAG

- **🔒 Sistem Autentikasi**
  - Registrasi dan login pengguna opsional
  - Mode tamu untuk pertanyaan cepat (penyimpanan chat 24 jam)
  - Riwayat chat permanen untuk pengguna terdaftar

- **📚 Manajemen Chat**
  - Simpan dan atur riwayat percakapan
  - Buat beberapa sesi chat
  - Judul chat otomatis
  - Hapus percakapan yang tidak diinginkan

- **🎨 Pengalaman Pengguna**
  - Antarmuka modern dan bersih dengan mode gelap/terang
  - Respons format Markdown dengan highlighting kode
  - Desain responsif mobile
  - Indikator mengetik real-time

- **❓ Bantuan & Dukungan**
  - Bagian FAQ komprehensif
  - Panduan penggunaan
  - Opsi kontak dukungan

### Untuk Administrator

- **📊 Manajemen Data**
  - Endpoint seeding data RAG
  - Generasi embedding vektor
  - Utilitas pembersihan database

- **🔧 Konfigurasi Sistem**
  - Kontrol rate limiting
  - Manajemen middleware API
  - Integrasi API eksternal (cuaca, berita, dll.)

---

## 🛠 Teknologi

### Frontend
- **Framework**: Next.js 15 (App Router)
- **Bahasa**: TypeScript
- **UI Library**: React 18
- **Styling**: Tailwind CSS
- **Komponen**: shadcn/ui
- **Ikon**: Lucide React
- **Form**: React Hook Form + validasi Zod
- **Notifikasi**: Sonner

### Backend
- **Runtime**: Node.js
- **API**: Next.js API Routes
- **Database**: PostgreSQL 16
- **ORM**: Drizzle ORM
- **Pencarian Vektor**: ekstensi pgvector
- **Autentikasi**: JWT (jsonwebtoken)
- **Password Hashing**: bcryptjs

### AI & ML
- **LLM**: Google Gemini 1.5 Flash
- **Embeddings**: Google Generative AI Embeddings (768 dimensi)
- **RAG Framework**: Implementasi custom

### DevOps
- **Containerization**: Docker & Docker Compose
- **Package Manager**: npm/yarn/pnpm
- **Kualitas Kode**: ESLint
- **Version Control**: Git

---

## ⚙️ Prasyarat

Sebelum memulai, pastikan Anda telah menginstal:

- **Node.js**: v18.0.0 atau lebih tinggi ([Download](https://nodejs.org/))
- **PostgreSQL**: v16.0 atau lebih tinggi ([Download](https://www.postgresql.org/download/))
  - Dengan ekstensi `pgvector` diaktifkan
- **Docker** (Opsional): Untuk deployment containerized ([Download](https://www.docker.com/))
- **Git**: Untuk version control ([Download](https://git-scm.com/))

### API Key yang Diperlukan

- **Google AI API Key**: Dapatkan dari [Google AI Studio](https://makersuite.google.com/app/apikey)

---

## 🚀 Instalasi

### 1. Clone Repository

```bash
git clone https://github.com/yourusername/chatbot-portal-informasi.git
cd chatbot-portal-informasi
```

### 2. Install Dependencies

```bash
npm install
# atau
yarn install
# atau
pnpm install
```

### 3. Setup Environment Variables

Buat file `.env.local` di root directory:

```env
# Konfigurasi Database
DATABASE_URL=postgresql://username:password@localhost:5432/dbname

# JWT Secret (generate string random yang aman)
JWT_SECRET=your-super-secret-jwt-key-min-32-chars

# Konfigurasi Google AI
GEMINI_API_KEY=your-google-ai-api-key
GENERATIVE_MODEL=gemini-1.5-flash

# Opsional: External APIs
OPENWEATHER_API_KEY=your-openweather-key
NEWS_API_KEY=your-news-api-key

# Konfigurasi RAG (Opsional)
SIMILARITY_THRESHOLD=0.5
EXTERNAL_API_CACHE_TTL=3600
EMBEDDING_CACHE_ENABLED=true

# Node Environment
NODE_ENV=development
```

### 4. Setup PostgreSQL Database

#### Opsi A: Menggunakan Docker Compose (Direkomendasikan)

```bash
docker-compose up -d
```

Ini akan memulai PostgreSQL dengan ekstensi pgvector yang sudah diaktifkan.

#### Opsi B: Setup Manual

1. Buat database PostgreSQL baru
2. Aktifkan ekstensi pgvector:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 5. Jalankan Database Migrations

```bash
npm run db:push
# atau
npx drizzle-kit push
```

### 6. Seed Database (Opsional)

Isi database dengan data RAG awal:

```bash
# Menggunakan API endpoint
curl -X POST http://localhost:3000/api/seed
```

Atau kunjungi `http://localhost:3000/api/seed` di browser Anda.

### 7. Jalankan Development Server

```bash
npm run dev
```

Kunjungi [http://localhost:3000](http://localhost:3000) untuk melihat aplikasi.

---

## 📱 Penggunaan

### Untuk Pengguna

#### 1. **Akses Aplikasi**
Navigasi ke homepage di `http://localhost:3000` atau URL deployment Anda.

#### 2. **Mulai Chat**
- Klik "Percakapan Baru" atau ketik langsung di kolom input
- Ajukan pertanyaan dalam Bahasa Indonesia tentang Kabupaten Madiun
- Contoh:
  - "Siapa Sekretaris Daerah Kabupaten Madiun?"
  - "Bagaimana cara mengurus KTP di Madiun?"
  - "Apa saja program bantuan sosial tahun 2024?"

#### 3. **Mode Tamu vs Pengguna Terdaftar**

**Mode Tamu:**
- Akses langsung tanpa login
- Chat disimpan selama 24 jam
- Terbatas pada sesi sementara

**Pengguna Terdaftar:**
- Buat akun melalui "Daftar"
- Riwayat chat permanen
- Manajemen percakapan terorganisir
- Hapus chat yang tidak diinginkan

#### 4. **Mengelola Chat**
- Lihat riwayat chat di sidebar
- Klik chat apapun untuk melanjutkan percakapan
- Hapus chat dengan klik ikon hapus
- Buat chat baru kapan saja

#### 5. **Mendapatkan Bantuan**
- Klik tombol bantuan (?) untuk FAQ
- Hubungi dukungan melalui link email

---

## 👨‍💻 Panduan Developer

### Struktur Proyek

```
chatbot-portal-informasi/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API routes
│   │   │   ├── auth/          # Endpoint autentikasi
│   │   │   ├── chat/          # Endpoint chat
│   │   │   ├── rag/           # Endpoint data RAG
│   │   │   └── seed/          # Database seeding
│   │   ├── auth/              # Halaman auth
│   │   ├── chat/              # Halaman chat
│   │   ├── context/           # React contexts
│   │   └── page.tsx           # Homepage
│   ├── components/            # Komponen React
│   │   ├── chat/              # Komponen chat
│   │   └── ui/                # Komponen UI (shadcn)
│   ├── hooks/                 # Custom React hooks
│   ├── lib/                   # Utilities dan libraries
│   │   ├── auth/              # Utilitas auth
│   │   ├── db/                # Config & schema database
│   │   ├── services/          # Logika bisnis services
│   │   │   ├── ai/            # Services AI & RAG
│   │   │   ├── auth/          # Services auth
│   │   │   ├── database/      # Services database
│   │   │   └── external/      # Client API eksternal
│   │   └── types/             # Tipe TypeScript
│   └── middleware/            # Middleware API
├── migrations/                # Migrasi database
├── public/                    # Aset statis
├── .env.local                 # Environment variables
├── drizzle.config.ts         # Config Drizzle ORM
├── next.config.ts            # Config Next.js
├── tailwind.config.ts        # Config Tailwind CSS
└── tsconfig.json             # Config TypeScript
```

### File Penting

- **[`src/app/api/chat/route.ts`](src/app/api/chat/route.ts)**: Endpoint API chat utama dengan integrasi RAG
- **[`src/lib/services/ai/rag.service.ts`](src/lib/services/ai/rag.service.ts)**: Logika retrieval RAG
- **[`src/lib/services/ai/embeddings.service.ts`](src/lib/services/ai/embeddings.service.ts)**: Generasi embedding
- **[`src/lib/db/schema.ts`](src/lib/db/schema.ts)**: Definisi skema database
- **[`src/app/context/auth-context.tsx`](src/app/context/auth-context.tsx)**: Context autentikasi
- **[`src/hooks/use-chat.ts`](src/hooks/use-chat.ts)**: Hook manajemen chat

### Workflow Development

#### 1. **Menjalankan Development Server**

```bash
npm run dev
```

Aplikasi akan tersedia di `http://localhost:3000`.

#### 2. **Manajemen Database**

```bash
# Generate migrations
npm run db:generate

# Push perubahan schema
npm run db:push

# Buka Drizzle Studio (UI database)
npm run db:studio
```

#### 3. **Menambahkan Data RAG Baru**

Edit [`src/app/api/rag/data/route.ts`](src/app/api/rag/data/route.ts) untuk menambahkan data baru:

```typescript
const ragDataToInsert = [
  {
    content: "Konten Anda di sini",
    data: {
      type: "pejabat", // atau tipe lainnya
      name: "Nama",
      position: "Jabatan",
      unit: "Unit"
    },
    embedding: [] // Akan di-generate otomatis
  }
];
```

Kemudian seed database:

```bash
curl -X POST http://localhost:3000/api/rag/data
```

#### 4. **Kustomisasi Prompt AI**

Edit system prompt di [`src/app/api/chat/route.ts`](src/app/api/chat/route.ts):

```typescript
const systemPrompt = `
  Prompt custom Anda di sini...
`;
```

#### 5. **Menambahkan Integrasi API Eksternal**

Lihat [`src/lib/services/external/api-client.service.ts`](src/lib/services/external/api-client.service.ts) untuk contoh integrasi API eksternal (cuaca, berita, dll.).

---

## 📡 Dokumentasi API

### Endpoint Autentikasi

#### POST `/api/auth/register`
Registrasi pengguna baru.

**Request Body:**
```json
{
  "username": "string",
  "email": "string",
  "password": "string"
}
```

#### POST `/api/auth/login`
Login pengguna.

**Request Body:**
```json
{
  "identifier": "string", // email atau username
  "password": "string"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": { "id": "uuid", "email": "string", "username": "string" },
    "accessToken": "string",
    "refreshToken": "string"
  }
}
```

### Endpoint Chat

#### POST `/api/chat`
Kirim pesan dan dapatkan respons AI.

**Request Body:**
```json
{
  "message": "string",
  "chatId": "uuid" // opsional
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "chatId": "uuid",
    "userMessage": { "id": "uuid", "role": "user", "content": "string" },
    "aiMessage": { "id": "uuid", "role": "bot", "content": "string" },
    "sources": [
      { "title": "string", "source": "string", "similarity": 0.95 }
    ]
  }
}
```

#### GET `/api/chat/[chatId]`
Dapatkan riwayat chat untuk percakapan tertentu.

#### DELETE `/api/chat/[chatId]`
Hapus chat tertentu.

#### GET `/api/chat/list`
Dapatkan semua chat untuk pengguna yang ter-autentikasi.

### Endpoint RAG

#### POST `/api/rag/data`
Seed data RAG (generate embeddings).

#### POST `/api/seed`
Seed database dengan data yang telah ditentukan.

---

## 🗄 Skema Database

### Tabel Users
```typescript
users {
  id: uuid (PK)
  username: varchar(50) UNIQUE
  email: text UNIQUE
  password: text
  role: varchar (default: "user")
  avatar: text
  createdAt: timestamp
  updatedAt: timestamp
  lastLogin: timestamp
}
```

### Tabel Conversations
```typescript
conversations {
  id: uuid (PK)
  userId: uuid (FK -> users.id, nullable)
  title: text
  isGuestChat: boolean (default: false)
  guestSessionId: varchar(255)
  expiresAt: timestamp
  createdAt: timestamp
  updatedAt: timestamp
}
```

### Tabel Messages
```typescript
messages {
  id: uuid (PK)
  chatId: uuid (FK -> conversations.id)
  role: varchar(20) // "user" atau "bot"
  content: text
  createdAt: timestamp
}
```

### Tabel RAG Data
```typescript
ragData {
  id: uuid (PK)
  content: text
  data: jsonb
  embedding: vector(768) // pgvector
  title: text
  source: varchar(50) (default: "internal")
  external_id: varchar(255)
  is_cached: boolean
  cache_expires_at: timestamp
  similarity_score: real
  createdAt: timestamp
  updatedAt: timestamp
}
```

---

## 🔐 Environment Variables

| Variable                  | Deskripsi                                       | Wajib | Default            |
| ------------------------- | ----------------------------------------------- | ----- | ------------------ |
| `DATABASE_URL`            | String koneksi PostgreSQL                       | ✅     | -                  |
| `JWT_SECRET`              | Kunci rahasia untuk token JWT (min 32 karakter) | ✅     | -                  |
| `GEMINI_API_KEY`          | API key Google AI                               | ✅     | -                  |
| `GENERATIVE_MODEL`        | Nama model Gemini                               | ❌     | `gemini-1.5-flash` |
| `SIMILARITY_THRESHOLD`    | Threshold similarity RAG (0-1)                  | ❌     | `0.5`              |
| `EXTERNAL_API_CACHE_TTL`  | TTL cache dalam detik                           | ❌     | `3600`             |
| `EMBEDDING_CACHE_ENABLED` | Aktifkan cache embedding                        | ❌     | `true`             |
| `NODE_ENV`                | Environment Node                                | ❌     | `development`      |

---

## 🚢 Deployment

### Deploy ke Vercel (Direkomendasikan)

1. Push kode Anda ke GitHub
2. Import repository Anda ke [Vercel](https://vercel.com)
3. Tambahkan environment variables di dashboard Vercel
4. Deploy!

Untuk database, gunakan:
- [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres)
- [Neon](https://neon.tech/) (direkomendasikan untuk pgvector)
- [Supabase](https://supabase.com/)

### Deploy dengan Docker

```bash
# Build image
docker build -t chatbot-portal .

# Run container
docker run -p 3000:3000 --env-file .env.local chatbot-portal
```

Atau gunakan Docker Compose:

```bash
docker-compose up -d
```

---

## 🤝 Kontribusi

Kontribusi sangat diterima! Silakan ikuti langkah berikut:

1. Fork repository
2. Buat branch fitur (`git checkout -b feature/fitur-amazing`)
3. Commit perubahan Anda (`git commit -m 'Tambah fitur amazing'`)
4. Push ke branch (`git push origin feature/fitur-amazing`)
5. Buka Pull Request

### Panduan Development

- Ikuti praktik terbaik TypeScript
- Gunakan ESLint dan Prettier untuk formatting kode
- Tulis commit message yang bermakna
- Tambahkan komentar untuk logika kompleks
- Perbarui dokumentasi sesuai kebutuhan

---

## 📄 Lisensi

Proyek ini dilisensikan di bawah MIT License - lihat file [LICENSE](LICENSE) untuk detail.

---

## 📧 Kontak

**Developer**: Illufox Kasunagi  
**Email**: [ariefsatria2409@gmail.com](mailto:ariefsatria2409@gmail.com)  
**GitHub**: [@illufoxKusanagi](https://github.com/illufoxKusanagi)

**Link Proyek**: [https://github.com/yourusername/chatbot-portal-informasi](https://github.com/yourusername/chatbot-portal-informasi)

---

<div align="center">

Dibuat dengan 💗 oleh Illufox Kasunagi

**[⬆ Kembali ke Atas](#-rag-portal-informasi-publik-kabupaten-madiun)**

</div>