"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import { ImageOff, RotateCcw, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface FiguralImageFrameProps {
  src?: string | null;
  alt: string;
  className?: string;
}

export function FiguralImageFrame({
  src,
  alt,
  className,
}: FiguralImageFrameProps) {
  const [hasError, setHasError] = useState(false);
  const [imgKey, setImgKey] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setHasError(false);
    setImgKey(0);
  }, [src]);

  if (!src) return null;

  const handleRetry = () => {
    setHasError(false);
    setImgKey((prev) => prev + 1);
  };

  const renderErrorFallback = (extraClassName?: string) => (
    <div
      className={cn(
        "flex min-h-40 w-full flex-col items-center justify-center gap-3 rounded-lg border border-border bg-muted/40 p-4 text-center",
        extraClassName
      )}
    >
      <ImageOff className="size-6 text-muted-foreground" />
      <p className="text-xs text-muted-foreground">
        Gambar soal gagal dimuat.
      </p>
      <Button type="button" variant="outline" size="sm" onClick={handleRetry}>
        <RotateCcw data-icon="inline-start" />
        Muat Ulang
      </Button>
    </div>
  );

  if (hasError && !isOpen) {
    return renderErrorFallback(className);
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {hasError ? (
        renderErrorFallback(className)
      ) : (
        <DialogTrigger asChild>
          <button
            type="button"
            aria-label={`Perbesar ${alt}`}
            className={cn(
              "group flex min-h-40 w-full cursor-zoom-in flex-col justify-center gap-2 rounded-lg border border-border bg-white p-3 text-left transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-zinc-100",
              className
            )}
          >
            <img
              key={imgKey}
              src={src}
              alt={alt}
              loading="lazy"
              onError={() => setHasError(true)}
              className="mx-auto max-h-72 w-auto object-contain"
            />
            <span className="inline-flex items-center justify-end gap-1.5 text-xs font-medium text-zinc-600 transition-colors group-hover:text-zinc-900">
              <ZoomIn className="size-3.5" />
              Perbesar gambar
            </span>
          </button>
        </DialogTrigger>
      )}

      <DialogContent className="max-w-3xl sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{alt}</DialogTitle>
        </DialogHeader>
        {hasError ? (
          renderErrorFallback()
        ) : (
          <div className="rounded-lg border border-border bg-white p-3 dark:bg-zinc-100">
            <img
              key={imgKey}
              src={src}
              alt={alt}
              onError={() => setHasError(true)}
              className="mx-auto max-h-[80vh] w-auto object-contain"
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
