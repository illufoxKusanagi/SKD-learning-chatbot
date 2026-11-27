'use client';

import { ArrowUp, Lightbulb, Sparkles, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import AddAttachment from './add-attachment';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

type ChatInputProps = {
  onSendMessage: (message: string) => void;
  onSendQuickPrompt?: (prompt: string) => void;
  isLoading?: boolean;
};

const QUICK_PROMPTS = [
  {
    label: 'Soal TWK HOTS',
    prompt: 'Berikan 1 soal latihan TWK HOTS beserta opsi A-E',
    category: 'TWK',
  },
  {
    label: 'Soal TIU Silogisme/Numerik',
    prompt: 'Berikan 1 soal latihan TIU Silogisme/Numerik beserta opsi A-E',
    category: 'TIU',
  },
  {
    label: 'Soal TKP BerAKHLAK',
    prompt: 'Berikan 1 soal latihan TKP BerAKHLAK beserta opsi A-E',
    category: 'TKP',
  },
  {
    label: 'Kisi-kisi & Passing Grade',
    prompt: 'Jelaskan kisi-kisi terbaru dan passing grade SKD CPNS',
    category: 'INFO',
  },
];

export default function ChatInput({
  onSendMessage,
  onSendQuickPrompt,
  isLoading = false,
}: ChatInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const router = useRouter();

  const submitMessage = () => {
    if (!inputValue.trim() || isLoading) return;
    onSendMessage(inputValue);
    setInputValue('');
    setShowSuggestions(false);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    submitMessage();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
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
        <div className="p-3 rounded-xl border border-border bg-card/95 shadow-md backdrop-blur transition-all flex flex-col gap-2 animate-in fade-in-50 duration-150">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-bold text-primary">
              <Sparkles className="size-3.5" />
              Rekomendasi Latihan Cepat SKD
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setShowSuggestions(false)}
              aria-label="Tutup rekomendasi"
              className="size-7 text-muted-foreground hover:text-foreground"
            >
              <X />
            </Button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {QUICK_PROMPTS.map((item) => (
              <Button
                key={item.label}
                type="button"
                variant="outline"
                size="sm"
                disabled={isLoading}
                onClick={() => handleSelectQuickPrompt(item.prompt)}
                className="h-auto rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-primary/10 hover:border-primary/50 hover:text-primary"
              >
                {item.label}
              </Button>
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
            className="rounded-lg size-9 cursor-pointer transition-all disabled:opacity-40"
          >
            <ArrowUp />
            <span className="sr-only">Send</span>
          </Button>
        </div>

        <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2">
          <AddAttachment />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => router.push('/help')}
            className="rounded-lg h-8 px-3 text-xs font-semibold cursor-pointer"
          >
            FAQ
          </Button>
          <Button
            type="button"
            variant={showSuggestions ? 'default' : 'outline'}
            size="icon"
            onClick={() => setShowSuggestions((prev) => !prev)}
            aria-label="Saran Cepat SKD"
            className={cn(
              'rounded-lg size-8 cursor-pointer transition-colors',
              showSuggestions && 'bg-primary text-primary-foreground'
            )}
          >
            <Lightbulb />
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
