"use client";

import { ArrowUp, Lightbulb, Sparkles, X } from "lucide-react";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import AddAttachment from "./add-attachment";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

type ChatInputProps = {
  onSendMessage: (message: string) => void;
  onSendQuickPrompt?: (prompt: string) => void;
  isLoading?: boolean;
};

const QUICK_PROMPTS = [
  {
    label: "Soal TWK HOTS",
    prompt: "Berikan 1 soal latihan TWK HOTS beserta opsi A-E",
    category: "TWK",
  },
  {
    label: "Soal TIU Silogisme/Numerik",
    prompt: "Berikan 1 soal latihan TIU Silogisme/Numerik beserta opsi A-E",
    category: "TIU",
  },
  {
    label: "Soal TKP BerAKHLAK",
    prompt: "Berikan 1 soal latihan TKP BerAKHLAK beserta opsi A-E",
    category: "TKP",
  },
  {
    label: "Kisi-kisi & Passing Grade",
    prompt: "Jelaskan kisi-kisi terbaru dan passing grade SKD CPNS",
    category: "INFO",
  },
];

export default function ChatInput({
  onSendMessage,
  onSendQuickPrompt,
  isLoading = false,
}: ChatInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const router = useRouter();

  const submitMessage = () => {
    if (!inputValue.trim() || isLoading) return;
    onSendMessage(inputValue);
    setInputValue("");
    setShowSuggestions(false);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    submitMessage();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const form = e.currentTarget.form;
      form?.requestSubmit();
    }
  };

  const handleSelectQuickPrompt = (prompt: string) => {
    if (onSendQuickPrompt) {
      onSendQuickPrompt(prompt);
    } else {
      onSendMessage(prompt);
    }
    setShowSuggestions(false);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="relative w-full max-w-3xl flex flex-col justify-center gap-2"
    >
      {/* Suggestions / Saran Drawer Bar */}
      {showSuggestions && (
        <div className="p-3 rounded-xl border border-border bg-card/95 shadow-md backdrop-blur transition-all space-y-2 animate-in fade-in-50 duration-150">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-bold text-primary">
              <Sparkles className="w-3.5 h-3.5" />
              Rekomendasi Latihan Cepat SKD
            </span>
            <button
              type="button"
              onClick={() => setShowSuggestions(false)}
              className="text-muted-foreground hover:text-foreground text-xs p-1 rounded cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {QUICK_PROMPTS.map((item) => (
              <button
                key={item.label}
                type="button"
                disabled={isLoading}
                onClick={() => handleSelectQuickPrompt(item.prompt)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border bg-background text-xs font-medium text-foreground hover:bg-primary/10 hover:border-primary/50 hover:text-primary transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Textarea Container */}
      <div className="relative w-full">
        <div className="absolute bottom-4 right-4 z-10">
          <Button
            type="submit"
            size="icon"
            disabled={isLoading || !inputValue.trim()}
            className="rounded-lg h-9 w-9 cursor-pointer transition-all disabled:opacity-40"
          >
            <ArrowUp className="h-4 w-4" />
            <span className="sr-only">Send</span>
          </Button>
        </div>

        <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2">
          <AddAttachment />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => router.push("/help")}
            className="rounded-lg h-8 px-3 text-xs font-semibold cursor-pointer"
          >
            FAQ
          </Button>
          <Button
            type="button"
            variant={showSuggestions ? "default" : "outline"}
            size="icon"
            onClick={() => setShowSuggestions((prev) => !prev)}
            aria-label="Saran Cepat SKD"
            className={cn(
              "rounded-lg h-8 w-8 cursor-pointer transition-colors",
              showSuggestions && "bg-primary text-primary-foreground"
            )}
          >
            <Lightbulb className="h-4 w-4" />
          </Button>
        </div>

        <Textarea
          onKeyDown={handleKeyDown}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Tanyakan materi atau minta soal SKD (TWK, TIU, TKP)..."
          className="min-h-32 w-full resize-none rounded-xl p-4 pr-16 pb-16 text-sm"
          disabled={isLoading}
          aria-disabled={isLoading}
        />
      </div>
    </form>
  );
}