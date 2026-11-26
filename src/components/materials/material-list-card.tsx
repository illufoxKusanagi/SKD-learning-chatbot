'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { MaterialSummary } from './material-types';

interface MaterialListCardProps {
  item: MaterialSummary;
  isActive: boolean;
  onSelect: (slug: string) => void;
}

export function MaterialListCard({
  item,
  isActive,
  onSelect,
}: MaterialListCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item.slug)}
      className="w-full text-left focus-visible:outline-none"
    >
      <Card
        className={cn(
          'gap-2 py-3.5 shadow-none transition-colors hover:border-primary/50',
          isActive && 'border-primary bg-accent/40'
        )}
      >
        <CardHeader className="gap-1.5 px-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">{item.subtopic}</Badge>
            <Badge variant="outline">{item.linkedQuestionCount} soal</Badge>
            {item.mistakeCount > 0 && (
              <Badge variant="destructive">{item.mistakeCount} salah</Badge>
            )}
          </div>
          <CardTitle className="text-sm font-semibold leading-snug">
            {item.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4">
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {item.summary}
          </p>
        </CardContent>
      </Card>
    </button>
  );
}
