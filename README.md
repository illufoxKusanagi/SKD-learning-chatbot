<div align="center">

# RAG Portal Informasi Publik Kabupaten Madiun

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-316192?style=for-the-badge&logo=postgresql)](https://www.postgresql.org/)
[![Google AI](https://img.shields.io/badge/Google_AI-Gemini-4285F4?style=for-the-badge&logo=google)](https://ai.google.dev/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

**An intelligent chatbot system powered by RAG (Retrieval-Augmented Generation) technology for Madiun Regency public information services**

[Features](#-features) • [Demo](#-demo) • [Installation](#-installation) • [Usage](#-usage) • [Developer Guide](#-developer-guide) • [Contributing](#-contributing)

[🇮🇩 Baca dalam Bahasa Indonesia](README.id.md)

</div>

---

## 📋 Table of Contents

- [About](#-about)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Usage](#-usage)
  - [For Users](#for-users)
  - [For Developers](#for-developers)
- [Developer Guide](#-developer-guide)
- [API Documentation](#-api-documentation)
- [Database Schema](#-database-schema)
- [Environment Variables](#-environment-variables)
- [Deployment](#-deployment)
- [Contributing](#-contributing)
- [License](#-license)
- [Contact](#-contact)

---

## 📖 About

RAG Portal Informasi Publik is an AI-powered chatbot system designed to provide quick and accurate access to public information about Madiun Regency. Using advanced RAG (Retrieval-Augmented Generation) technology, the system retrieves relevant information from a curated database and generates contextual responses using Google's Gemini AI model.

### Key Highlights

- 🎯 **Accurate Information**: AI responses based on verified government data
- 🔍 **Smart Search**: Vector-based semantic search with pgvector
- 🌐 **Bilingual Support**: Primarily Indonesian with intelligent language detection
- 🔐 **User Authentication**: Optional login to save chat history
- 📱 **Responsive Design**: Works seamlessly on desktop and mobile
- ⚡ **Real-time Responses**: Fast and efficient AI-powered answers

---

## ✨ Features

### For End Users

- **💬 Intelligent Chatbot**
  - Ask questions about Madiun Regency in natural language
  - Get accurate answers from government officials, regulations, and public services data
  - Context-aware responses using RAG technology

- **🔒 Authentication System**
  - Optional user registration and login
  - Guest mode for quick queries (24-hour chat retention)
  - Persistent chat history for registered users

- **📚 Chat Management**
  - Save and organize conversation history
  - Create multiple chat sessions
  - Auto-generated chat titles
  - Delete unwanted conversations

- **🎨 User Experience**
  - Clean, modern interface with dark/light mode
  - Markdown-formatted responses with code highlighting
  - Mobile-responsive design
  - Real-time typing indicators

- **❓ Help & Support**
  - Comprehensive FAQ section
  - Usage guidelines
  - Contact support options

### For Administrators

- **📊 Data Management**
  - RAG data seeding endpoint
  - Vector embedding generation
  - Database cleanup utilities

- **🔧 System Configuration**
  - Rate limiting controls
  - API middleware management
  - External API integration (weather, news, etc.)

---

## 🛠 Tech Stack

### Frontend
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **UI Library**: React 18
- **Styling**: Tailwind CSS
- **Components**: shadcn/ui
- **Icons**: Lucide React
- **Forms**: React Hook Form + Zod validation
- **Notifications**: Sonner

### Backend
- **Runtime**: Node.js
- **API**: Next.js API Routes
- **Database**: PostgreSQL 16
- **ORM**: Drizzle ORM
- **Vector Search**: pgvector extension
- **Authentication**: JWT (jsonwebtoken)
- **Password Hashing**: bcryptjs

### AI & ML
- **LLM**: Google Gemini 1.5 Flash
- **Embeddings**: Google Generative AI Embeddings (768 dimensions)
- **RAG Framework**: Custom implementation

### DevOps
- **Containerization**: Docker & Docker Compose
- **Package Manager**: npm/yarn/pnpm
- **Code Quality**: ESLint
- **Version Control**: Git

---

## ⚙️ Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: v18.0.0 or higher ([Download](https://nodejs.org/))
- **PostgreSQL**: v16.0 or higher ([Download](https://www.postgresql.org/download/))
  - With `pgvector` extension enabled
- **Docker** (Optional): For containerized deployment ([Download](https://www.docker.com/))
- **Git**: For version control ([Download](https://git-scm.com/))

### Required API Keys

- **Google AI API Key**: Get from [Google AI Studio](https://makersuite.google.com/app/apikey)

---

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/chatbot-portal-informasi.git
cd chatbot-portal-informasi
```

### 2. Install Dependencies

```bash
npm install
# or
yarn install
# or
pnpm install
```

### 3. Set Up Environment Variables

Create a `.env.local` file in the root directory:

```env
# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/dbname

# JWT Secret (generate a secure random string)
JWT_SECRET=your-super-secret-jwt-key-min-32-chars

# Google AI Configuration
GEMINI_API_KEY=your-google-ai-api-key
GENERATIVE_MODEL=gemini-1.5-flash

# Optional: External APIs
OPENWEATHER_API_KEY=your-openweather-key
NEWS_API_KEY=your-news-api-key

# RAG Configuration (Optional)
SIMILARITY_THRESHOLD=0.5
EXTERNAL_API_CACHE_TTL=3600
EMBEDDING_CACHE_ENABLED=true

# Node Environment
NODE_ENV=development
```

### 4. Set Up PostgreSQL Database

#### Option A: Using Docker Compose (Recommended)

```bash
docker-compose up -d
```

This will start PostgreSQL with pgvector extension enabled.

#### Option B: Manual Setup

1. Create a new PostgreSQL database
2. Enable pgvector extension:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 5. Run Database Migrations

```bash
npm run db:push
# or
npx drizzle-kit push
```

### 6. Seed the Database (Optional)

Populate the database with initial RAG data:

```bash
# Using the API endpoint
curl -X POST http://localhost:3000/api/seed
```

Or visit `http://localhost:3000/api/seed` in your browser.

### 7. Start the Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the application.

---

## 📱 Usage

### For Users

#### 1. **Access the Application**
Navigate to the homepage at `http://localhost:3000` or your deployed URL.

#### 2. **Start Chatting**
- Click "Percakapan Baru" (New Conversation) or type directly in the input field
- Ask questions in Indonesian about Madiun Regency
- Examples:
  - "Siapa Sekretaris Daerah Kabupaten Madiun?"
  - "Bagaimana cara mengurus KTP di Madiun?"
  - "Apa saja program bantuan sosial tahun 2024?"

#### 3. **Guest vs Registered User**

**Guest Mode:**
- Immediate access without login
- Chats are saved for 24 hours
- Limited to temporary sessions

**Registered User:**
- Create an account via "Daftar" (Register)
- Persistent chat history
- Organized conversation management
- Delete unwanted chats

#### 4. **Managing Chats**
- View chat history in the sidebar
- Click on any chat to continue the conversation
- Delete chats by clicking the delete icon
- Create new chats anytime

#### 5. **Get Help**
- Click the help button (?) for FAQ
- Contact support via email link

---

## 👨‍💻 Developer Guide

### Project Structure

```
chatbot-portal-informasi/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API routes
│   │   │   ├── auth/          # Authentication endpoints
│   │   │   ├── chat/          # Chat endpoints
│   │   │   ├── rag/           # RAG data endpoints
│   │   │   └── seed/          # Database seeding
│   │   ├── auth/              # Auth pages
│   │   ├── chat/              # Chat page
│   │   ├── context/           # React contexts
│   │   └── page.tsx           # Homepage
│   ├── components/            # React components
│   │   ├── chat/              # Chat-related components
│   │   └── ui/                # UI components (shadcn)
│   ├── hooks/                 # Custom React hooks
│   ├── lib/                   # Utilities and libraries
│   │   ├── auth/              # Auth utilities
│   │   ├── db/                # Database config & schema
│   │   ├── services/          # Business logic services
│   │   │   ├── ai/            # AI & RAG services
│   │   │   ├── auth/          # Auth services
│   │   │   ├── database/      # Database services
│   │   │   └── external/      # External API clients
│   │   └── types/             # TypeScript types
│   └── middleware/            # API middleware
├── migrations/                # Database migrations
├── public/                    # Static assets
├── .env.local                 # Environment variables
├── drizzle.config.ts         # Drizzle ORM config
├── next.config.ts            # Next.js config
├── tailwind.config.ts        # Tailwind CSS config
└── tsconfig.json             # TypeScript config
```

### Key Files

- **[`src/app/api/chat/route.ts`](src/app/api/chat/route.ts)**: Main chat API endpoint with RAG integration
- **[`src/lib/services/ai/rag.service.ts`](src/lib/services/ai/rag.service.ts)**: RAG retrieval logic
- **[`src/lib/services/ai/embeddings.service.ts`](src/lib/services/ai/embeddings.service.ts)**: Embedding generation
- **[`src/lib/db/schema.ts`](src/lib/db/schema.ts)**: Database schema definitions
- **[`src/app/context/auth-context.tsx`](src/app/context/auth-context.tsx)**: Authentication context
- **[`src/hooks/use-chat.ts`](src/hooks/use-chat.ts)**: Chat management hook

### Development Workflow

#### 1. **Running the Development Server**

```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

#### 2. **Database Management**

```bash
# Generate migrations
npm run db:generate

# Push schema changes
npm run db:push

# Open Drizzle Studio (database UI)
npm run db:studio
```

#### 3. **Adding New RAG Data**

Edit [`src/app/api/rag/data/route.ts`](src/app/api/rag/data/route.ts) to add new data:

```typescript
const ragDataToInsert = [
  {
    content: "Your content here",
    data: {
      type: "pejabat", // or other types
      name: "Name",
      position: "Position",
      unit: "Unit"
    },
    embedding: [] // Will be auto-generated
  }
];
```

Then seed the database:

```bash
curl -X POST http://localhost:3000/api/rag/data
```

#### 4. **Customizing the AI Prompt**

Edit the system prompt in [`src/app/api/chat/route.ts`](src/app/api/chat/route.ts):

```typescript
const systemPrompt = `
  Your custom prompt here...
`;
```

#### 5. **Adding External API Integration**

See [`src/lib/services/external/api-client.service.ts`](src/lib/services/external/api-client.service.ts) for examples of integrating external APIs (weather, news, etc.).

---

## 📡 API Documentation

### Authentication Endpoints

#### POST `/api/auth/register`
Register a new user.

**Request Body:**
```json
{
  "username": "string",
  "email": "string",
  "password": "string"
}
```

#### POST `/api/auth/login`
Login a user.

**Request Body:**
```json
{
  "identifier": "string", // email or username
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

### Chat Endpoints

#### POST `/api/chat`
Send a message and get AI response.

**Request Body:**
```json
{
  "message": "string",
  "chatId": "uuid" // optional
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
Get chat history for a specific conversation.

#### DELETE `/api/chat/[chatId]`
Delete a specific chat.

#### GET `/api/chat/list`
Get all chats for authenticated user.

### RAG Endpoints

#### POST `/api/rag/data`
Seed RAG data (generates embeddings).

#### POST `/api/seed`
Seed database with predefined data.

---

## 🗄 Database Schema

### Users Table
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

### Conversations Table
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

### Messages Table
```typescript
messages {
  id: uuid (PK)
  chatId: uuid (FK -> conversations.id)
  role: varchar(20) // "user" or "bot"
  content: text
  createdAt: timestamp
}
```

### RAG Data Table
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

| Variable                  | Description                              | Required | Default            |
| ------------------------- | ---------------------------------------- | -------- | ------------------ |
| `DATABASE_URL`            | PostgreSQL connection string             | ✅        | -                  |
| `JWT_SECRET`              | Secret key for JWT tokens (min 32 chars) | ✅        | -                  |
| `GEMINI_API_KEY`          | Google AI API key                        | ✅        | -                  |
| `GENERATIVE_MODEL`        | Gemini model name                        | ❌        | `gemini-1.5-flash` |
| `SIMILARITY_THRESHOLD`    | RAG similarity threshold (0-1)           | ❌        | `0.5`              |
| `EXTERNAL_API_CACHE_TTL`  | Cache TTL in seconds                     | ❌        | `3600`             |
| `EMBEDDING_CACHE_ENABLED` | Enable embedding cache                   | ❌        | `true`             |
| `NODE_ENV`                | Node environment                         | ❌        | `development`      |

---

## 🚢 Deployment

### Deploy to Vercel (Recommended)

1. Push your code to GitHub
2. Import your repository to [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Deploy!

For database, use:
- [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres)
- [Neon](https://neon.tech/) (recommended for pgvector)
- [Supabase](https://supabase.com/)

### Deploy with Docker

```bash
# Build the image
docker build -t chatbot-portal .

# Run the container
docker run -p 3000:3000 --env-file .env.local chatbot-portal
```

Or use Docker Compose:

```bash
docker-compose up -d
```

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Use ESLint and Prettier for code formatting
- Write meaningful commit messages
- Add comments for complex logic
- Update documentation as needed

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 📧 Contact

**Developer**: Illufox Kasunagi  
**Email**: [ariefsatria2409@gmail.com](mailto:ariefsatria2409@gmail.com)  
**GitHub**: [@illufoxKusanagi](https://github.com/illufoxKusanagi)

**Project Link**: [https://github.com/yourusername/chatbot-portal-informasi](https://github.com/yourusername/chatbot-portal-informasi)

---

<div align="center">

Made with 💗 by Illufox Kasunagi

**[⬆ Back to Top](#-rag-portal-informasi-publik-kabupaten-madiun)**

</div>