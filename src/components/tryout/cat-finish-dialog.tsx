"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { AlertTriangle, CheckCircle2, Flag, HelpCircle } from "lucide-react";

interface CatFinishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalQuestions: number;
  answeredCount: number;
  flaggedCount: number;
  isFinishing: boolean;
  onConfirmFinish: () => void;
}

export function CatFinishDialog({
  open,
  onOpenChange,
  totalQuestions,
  answeredCount,
  flaggedCount,
  isFinishing,
  onConfirmFinish,
}: CatFinishDialogProps) {
  const unansweredCount = Math.max(0, totalQuestions - answeredCount);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Selesaikan & Kunci Ujian?</DialogTitle>
          <DialogDescription>
            Setelah dikumpulkan, jawaban tidak dapat diubah lagi dan skor akhir
            SKD akan langsung dihitung.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col gap-1 rounded-lg border border-success/40 bg-success/10 p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-xs font-medium text-success">
              <CheckCircle2 className="size-3.5" />
              <span>Terjawab</span>
            </div>
            <span className="text-lg font-bold text-foreground">
              {answeredCount}
            </span>
          </div>

          <div className="flex flex-col gap-1 rounded-lg border border-border bg-muted/40 p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-xs font-medium text-muted-foreground">
              <HelpCircle className="size-3.5" />
              <span>Kosong</span>
            </div>
            <span className="text-lg font-bold text-foreground">
              {unansweredCount}
            </span>
          </div>

          <div className="flex flex-col gap-1 rounded-lg border border-warning/40 bg-warning/10 p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-xs font-medium text-warning">
              <Flag className="size-3.5" />
              <span>Ragu-ragu</span>
            </div>
            <span className="text-lg font-bold text-foreground">
              {flaggedCount}
            </span>
          </div>
        </div>

        {(unansweredCount > 0 || flaggedCount > 0) && (
          <Alert className="border-warning/50 bg-warning/10">
            <AlertTriangle className="text-warning" />
            <AlertTitle className="text-foreground">
              Masih Ada Soal yang Perlu Dicek
            </AlertTitle>
            <AlertDescription className="flex flex-wrap items-center gap-1.5 text-foreground">
              <span>Soal kosong bernilai 0 poin (termasuk TKP).</span>
              {flaggedCount > 0 && (
                <Badge variant="outline">{flaggedCount} ditandai ragu</Badge>
              )}
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isFinishing}
            onClick={() => onOpenChange(false)}
          >
            Lanjutkan Mengerjakan
          </Button>
          <Button
            type="button"
            disabled={isFinishing}
            onClick={onConfirmFinish}
          >
            {isFinishing && <Spinner data-icon="inline-start" />}
            Kumpulkan & Nilai
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
