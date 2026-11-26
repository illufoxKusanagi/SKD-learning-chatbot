"use client";

import { useState } from "react";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Layers, Play } from "lucide-react";
import type { QuizCategory } from "./quiz-utils";

export interface PracticePackConfigInput {
  count: 10 | 15 | 20;
  category: "ALL" | QuizCategory;
  wrongOnly: boolean;
}

interface QuizPackConfiguratorProps {
  isLoading?: boolean;
  initialCategory?: "ALL" | QuizCategory;
  onStartPack: (config: PracticePackConfigInput) => void;
}

export function QuizPackConfigurator({
  isLoading = false,
  initialCategory = "ALL",
  onStartPack,
}: QuizPackConfiguratorProps) {
  const [count, setCount] = useState<10 | 15 | 20>(10);
  const [category, setCategory] = useState<"ALL" | QuizCategory>(initialCategory);
  const [wrongOnly, setWrongOnly] = useState(false);

  return (
    <Card className="w-full gap-4 py-5 shadow-xs">
      <CardHeader className="gap-1.5 border-b pb-4">
        <div className="flex items-center gap-2">
          <Layers className="size-5 text-primary" />
          <CardTitle className="text-base">Paket Latihan SKD Instan</CardTitle>
        </div>
        <CardDescription>
          Atur jumlah soal, subtes, dan mode review untuk koreksi 0 ms beserta rasional A–E.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            Jumlah Soal
          </span>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={String(count)}
            onValueChange={(val) => {
              const num = Number(val);
              if (num === 10 || num === 15 || num === 20) setCount(num);
            }}
          >
            <ToggleGroupItem value="10">10 Soal</ToggleGroupItem>
            <ToggleGroupItem value="15">15 Soal</ToggleGroupItem>
            <ToggleGroupItem value="20">20 Soal</ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            Subtes SKD
          </span>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={category}
            onValueChange={(val) => {
              if (val) setCategory(val as "ALL" | QuizCategory);
            }}
          >
            <ToggleGroupItem value="ALL">Campuran</ToggleGroupItem>
            <ToggleGroupItem value="TWK">TWK</ToggleGroupItem>
            <ToggleGroupItem value="TIU">TIU</ToggleGroupItem>
            <ToggleGroupItem value="TKP">TKP</ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            Mode Filter Soal
          </span>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={wrongOnly ? "wrong" : "all"}
            onValueChange={(val) => {
              if (val) setWrongOnly(val === "wrong");
            }}
          >
            <ToggleGroupItem value="all">Semua Soal</ToggleGroupItem>
            <ToggleGroupItem value="wrong">Pernah Salah (Review)</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </CardContent>

      <CardFooter className="border-t pt-4">
        <Button
          type="button"
          className="w-full"
          disabled={isLoading}
          onClick={() => onStartPack({ count, category, wrongOnly })}
        >
          {isLoading ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <Play data-icon="inline-start" />
          )}
          Mulai Paket Latihan
        </Button>
      </CardFooter>
    </Card>
  );
}
