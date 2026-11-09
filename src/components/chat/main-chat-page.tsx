"use client";

import ChatInput from "./chat-input";
import { useChat } from "@/hooks/use-chat";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  History,
  ArrowRight,
} from "lucide-react";

export default function MainContent() {
  const { isLoading, handleSendMessage } = useChat();

  const QUICK_TOPICS = [
    {
      title: "TWK HOTS",
      desc: "Integritas, Bela Negara, Pilar Negara & Nasionalisme",
      prompt: "Berikan 1 soal latihan TWK HOTS beserta opsi A-E",
      color: "border-rose-500/30 hover:border-rose-500 hover:bg-rose-500/5",
      badgeColor: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
    },
    {
      title: "TIU Silogisme & Numerik",
      desc: "Penalaran logis, silogisme analitis, deret & pecahan",
      prompt: "Berikan 1 soal latihan TIU Silogisme/Numerik beserta opsi A-E",
      color: "border-blue-500/30 hover:border-blue-500 hover:bg-blue-500/5",
      badgeColor: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
    },
    {
      title: "TKP BerAKHLAK",
      desc: "Pelayanan publik, jejaring kerja, dan profesionalisme",
      prompt: "Berikan 1 soal latihan TKP BerAKHLAK beserta opsi A-E",
      color: "border-emerald-500/30 hover:border-emerald-500 hover:bg-emerald-500/5",
      badgeColor: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    },
  ];

  return (
    <div className="flex-1 flex flex-col gap-8 items-center justify-center w-full px-4 py-8 max-w-4xl mx-auto">
      {/* Hero Header */}
      <div className="flex flex-col w-full gap-3 items-center text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Tutor Interaktif Seleksi Kompetensi Dasar CPNS</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
          Platform Belajar SKD CPNS Berbasis AI
        </h1>

        <p className="text-sm sm:text-base text-muted-foreground max-w-xl leading-relaxed">
          Latihan soal interaktif TWK, TIU, dan TKP berstandar BKN dengan evaluasi skor instan, kunci jawaban terkunci, dan pembahasan HOTS terstruktur.
        </p>

        {/* Action Link to Quiz History */}
        <div className="pt-1">
          <Link href="/quiz-history">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 h-8 text-xs font-semibold border-border hover:bg-accent cursor-pointer"
            >
              <History className="w-3.5 h-3.5 text-primary" />
              <span>Lihat Riwayat Latihan Soal</span>
              <ArrowRight className="w-3 h-3 text-muted-foreground" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Quick-Start Subject Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-3xl">
        {QUICK_TOPICS.map((topic) => (
          <button
            key={topic.title}
            type="button"
            disabled={isLoading}
            onClick={() => handleSendMessage(topic.prompt)}
            className={`p-3.5 rounded-xl border bg-card text-left transition-all cursor-pointer shadow-xs active:scale-[0.98] ${topic.color} disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded ${topic.badgeColor}`}
              >
                {topic.title}
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground leading-snug">
              {topic.desc}
            </p>
          </button>
        ))}
      </div>

      {/* Chat Input */}
      <ChatInput
        onSendMessage={handleSendMessage}
        onSendQuickPrompt={(prompt) => handleSendMessage(prompt)}
        isLoading={isLoading}
      />
    </div>
  );
}