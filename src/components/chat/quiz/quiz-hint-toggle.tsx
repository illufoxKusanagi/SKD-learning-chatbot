"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Lightbulb } from "lucide-react";

interface QuizHintToggleProps {
  hint?: string | null;
  isRevealed: boolean;
  isAnswered: boolean;
  onReveal: () => void;
}

export function QuizHintToggle({
  hint,
  isRevealed,
  isAnswered,
  onReveal,
}: QuizHintToggleProps) {
  if (!hint?.trim()) return null;

  if (!isRevealed) {
    if (isAnswered) return null;
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        onClick={onReveal}
      >
        <Lightbulb data-icon="inline-start" />
        Tampilkan Petunjuk (Hint)
      </Button>
    );
  }

  return (
    <Alert className="bg-muted/50">
      <Lightbulb className="text-warning" />
      <AlertTitle>Petunjuk Konsep</AlertTitle>
      <AlertDescription className="whitespace-pre-line">
        {hint}
      </AlertDescription>
    </Alert>
  );
}
