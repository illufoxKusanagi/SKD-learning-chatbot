"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import type { TryoutMode } from "@/lib/scoring/skd-scoring";
import type { TryoutBankReadiness } from "@/lib/services/tryout.service";
import { cn } from "@/lib/utils";
import { AlertTriangle, ClipboardCheck, Play, Zap } from "lucide-react";
import { TRYOUT_CATEGORIES } from "./tryout-utils";

interface TryoutModeCardsProps {
  readiness: TryoutBankReadiness;
  startingMode: TryoutMode | null;
  onStartTryout: (mode: TryoutMode) => void;
}

export function TryoutModeCards({
  readiness,
  startingMode,
  onStartTryout,
}: TryoutModeCardsProps) {
  const deficits = TRYOUT_CATEGORIES.filter(
    (cat) => readiness.fullCat.deficits[cat] > 0
  );

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card className="flex flex-col gap-4 py-5 shadow-xs">
        <CardHeader className="gap-2 border-b pb-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="size-5 text-primary" />
              <CardTitle className="text-base">Full Simulasi CAT BKN</CardTitle>
            </div>
            <Badge
              variant={readiness.fullCat.ready ? "default" : "secondary"}
              className={cn(
                readiness.fullCat.ready && "bg-success text-success-foreground"
              )}
            >
              {readiness.fullCat.ready ? "Bank Soal Siap" : "Bank Belum Penuh"}
            </Badge>
          </div>
          <CardDescription>
            110 Soal • 100 Menit • Passing Grade Resmi: TWK 65, TIU 80, TKP 166
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-1 flex-col gap-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            {TRYOUT_CATEGORIES.map((cat) => (
              <div
                key={cat}
                className="flex flex-col gap-0.5 rounded-lg border border-border bg-muted/30 p-2.5"
              >
                <span className="text-[11px] font-medium text-muted-foreground">
                  {cat}
                </span>
                <span className="text-sm font-bold text-foreground">
                  {readiness.counts[cat]}/{readiness.fullCat.required[cat]}
                </span>
              </div>
            ))}
          </div>

          {!readiness.fullCat.ready && (
            <Alert className="border-warning/50 bg-warning/10">
              <AlertTriangle className="text-warning" />
              <AlertTitle className="text-foreground">
                Kuota Full CAT Belum Terpenuhi
              </AlertTitle>
              <AlertDescription className="text-xs text-foreground">
                Kurang:{" "}
                {deficits
                  .map((c) => `${c} (${readiness.fullCat.deficits[c]} soal)`)
                  .join(", ")}
                . Gunakan Mini CAT Tryout untuk simulasi cepat.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>

        <CardFooter className="border-t pt-4">
          <Button
            type="button"
            className="w-full"
            disabled={!readiness.fullCat.ready || startingMode !== null}
            onClick={() => onStartTryout("cat_tryout")}
          >
            {startingMode === "cat_tryout" ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <Play data-icon="inline-start" />
            )}
            Mulai Full CAT (110 Soal)
          </Button>
        </CardFooter>
      </Card>

      <Card className="flex flex-col gap-4 py-5 shadow-xs">
        <CardHeader className="gap-2 border-b pb-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Zap className="size-5 text-primary" />
              <CardTitle className="text-base">Mini CAT Tryout</CardTitle>
            </div>
            <Badge variant="outline">Latihan Cepat</Badge>
          </div>
          <CardDescription>
            30 Soal • 27 Menit • Proporsional: 8 TWK [PG 18], 10 TIU [PG 23],
            12 TKP [PG 45]
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-1 flex-col gap-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            {TRYOUT_CATEGORIES.map((cat) => (
              <div
                key={cat}
                className="flex flex-col gap-0.5 rounded-lg border border-border bg-muted/30 p-2.5"
              >
                <span className="text-[11px] font-medium text-muted-foreground">
                  {cat}
                </span>
                <span className="text-sm font-bold text-foreground">
                  {readiness.miniCat.required[cat]} soal (PG{" "}
                  {readiness.miniCat.passingGrades[cat]})
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Cocok untuk pemanasan cepat dengan timer BKN ketat dan laporan
            passing grade proporsional.
          </p>
        </CardContent>

        <CardFooter className="border-t pt-4">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={!readiness.miniCat.ready || startingMode !== null}
            onClick={() => onStartTryout("mini_tryout")}
          >
            {startingMode === "mini_tryout" ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <Play data-icon="inline-start" />
            )}
            Mulai Mini CAT (30 Soal)
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
