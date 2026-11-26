"use client";

import type { QuizAttemptItem } from "@/hooks/use-chat";
import type { PracticeQuestionMaterialItem } from "@/lib/services/practice.service";
import { Button } from "@/components/ui/button";
import { CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { ArrowRight, BookOpen, MessageSquarePlus } from "lucide-react";
import type { QuizCategory } from "./quiz-utils";

interface QuizCardFooterProps {
  quiz: QuizAttemptItem;
  materials?: PracticeQuestionMaterialItem[];
  onOpenMaterial?: (material: PracticeQuestionMaterialItem) => void;
  onAskTutor?: (quiz: QuizAttemptItem) => void;
  onNextQuiz?: (category: QuizCategory) => void;
  isChatLoading?: boolean;
  isGeneratingNext?: boolean;
  nextButtonLabel: string;
}

export function QuizCardFooter({
  quiz,
  materials,
  onOpenMaterial,
  onAskTutor,
  onNextQuiz,
  isChatLoading = false,
  isGeneratingNext = false,
  nextButtonLabel,
}: QuizCardFooterProps) {
  const hasTwkMaterials = Boolean(materials && materials.length > 0 && onOpenMaterial);
  if (!hasTwkMaterials && !onAskTutor && !onNextQuiz) return null;

  return (
    <>
      <Separator />
      <CardFooter className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {hasTwkMaterials && materials && onOpenMaterial && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenMaterial(materials[0])}
            >
              <BookOpen data-icon="inline-start" />
              Baca Materi Terkait
            </Button>
          )}
          {onAskTutor && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isChatLoading}
              onClick={() => onAskTutor(quiz)}
            >
              <MessageSquarePlus data-icon="inline-start" />
              Bedah Bareng Tutor
            </Button>
          )}
        </div>

        {onNextQuiz && (
          <Button
            type="button"
            size="sm"
            disabled={isGeneratingNext}
            onClick={() => onNextQuiz(quiz.category)}
          >
            {isGeneratingNext && <Spinner data-icon="inline-start" />}
            {nextButtonLabel}
            {!isGeneratingNext && <ArrowRight data-icon="inline-end" />}
          </Button>
        )}
      </CardFooter>
    </>
  );
}
