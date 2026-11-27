"use client";
/* eslint-disable @next/next/no-img-element */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ZoomIn } from "lucide-react";

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
  if (!src) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={`Perbesar ${alt}`}
          className={cn(
            "group flex w-full cursor-zoom-in flex-col gap-2 rounded-lg border border-border bg-white p-3 text-left transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-zinc-100",
            className
          )}
        >
          <img
            src={src}
            alt={alt}
            loading="lazy"
            className="mx-auto max-h-72 w-auto object-contain"
          />
          <span className="inline-flex items-center justify-end gap-1.5 text-xs font-medium text-zinc-600 transition-colors group-hover:text-zinc-900">
            <ZoomIn className="size-3.5" />
            Perbesar gambar
          </span>
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-3xl sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{alt}</DialogTitle>
        </DialogHeader>
        <div className="rounded-lg border border-border bg-white p-3 dark:bg-zinc-100">
          <img
            src={src}
            alt={alt}
            className="mx-auto max-h-[80vh] w-auto object-contain"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
