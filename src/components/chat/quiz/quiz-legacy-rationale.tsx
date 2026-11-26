"use client";

import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { BookOpen, ChevronDown, ChevronUp } from "lucide-react";

interface QuizLegacyRationaleProps {
  quizId: string;
  rubricRationale: string | null;
  aiExplanation: string | null;
}

export function QuizLegacyRationale({
  quizId,
  rubricRationale,
  aiExplanation,
}: QuizLegacyRationaleProps) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    setOpen(true);
  }, [quizId]);

  if (!rubricRationale && !aiExplanation) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="flex flex-col gap-2">
      <CollapsibleTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="w-fit">
          <BookOpen data-icon="inline-start" />
          {open ? "Sembunyikan Pembahasan" : "Lihat Pembahasan Resmi"}
          {open ? (
            <ChevronUp data-icon="inline-end" />
          ) : (
            <ChevronDown data-icon="inline-end" />
          )}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Alert className="bg-muted/40">
          <BookOpen />
          <AlertTitle>Pembahasan & Rasional Rubrik</AlertTitle>
          <AlertDescription className="flex flex-col gap-2 whitespace-pre-line">
            {rubricRationale && <p>{rubricRationale}</p>}
            {aiExplanation && <p>{aiExplanation}</p>}
          </AlertDescription>
        </Alert>
      </CollapsibleContent>
    </Collapsible>
  );
}
