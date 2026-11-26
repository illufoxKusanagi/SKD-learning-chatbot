'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TWK_SUBTOPICS } from './material-types';
import { AlertTriangle, Search, X } from 'lucide-react';

interface MaterialFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  selectedSubtopic: string;
  onSubtopicChange: (subtopic: string) => void;
  weakOnly: boolean;
  onWeakOnlyChange: (weakOnly: boolean) => void;
  weakCount: number;
  totalCount: number;
  subtopics?: readonly string[];
}

export function MaterialFilterBar({
  search,
  onSearchChange,
  selectedSubtopic,
  onSubtopicChange,
  weakOnly,
  onWeakOnlyChange,
  weakCount,
  totalCount,
  subtopics = TWK_SUBTOPICS,
}: MaterialFilterBarProps) {
  return (
    <div className="flex flex-col gap-3 border-b border-border bg-card/50 px-4 py-3 sm:px-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Cari topik, UU, pasal, peristiwa..."
            aria-label="Cari materi TWK"
            className="pl-9 pr-9"
          />
          {search && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Hapus pencarian"
              onClick={() => onSearchChange('')}
              className="absolute top-1/2 right-1 size-7 -translate-y-1/2"
            >
              <X />
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={weakOnly ? 'default' : 'outline'}
            size="sm"
            aria-pressed={weakOnly}
            onClick={() => onWeakOnlyChange(!weakOnly)}
          >
            <AlertTriangle data-icon="inline-start" />
            <span>Topik TWK Sering Salah</span>
            <Badge variant={weakOnly ? 'secondary' : 'outline'}>
              {weakCount}
            </Badge>
          </Button>
          <span className="hidden text-xs text-muted-foreground lg:inline">
            {totalCount} materi
          </span>
        </div>
      </div>

      <div
        role="group"
        aria-label="Filter subtopik TWK"
        className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0"
      >
        <Button
          type="button"
          variant={selectedSubtopic === '' ? 'default' : 'outline'}
          size="sm"
          aria-pressed={selectedSubtopic === ''}
          onClick={() => onSubtopicChange('')}
          className="h-7 shrink-0 rounded-full px-3 text-xs"
        >
          Semua Subtopik
        </Button>

        {subtopics.map((subtopic) => {
          const isActive = selectedSubtopic === subtopic;
          return (
            <Button
              key={subtopic}
              type="button"
              variant={isActive ? 'default' : 'outline'}
              size="sm"
              aria-pressed={isActive}
              onClick={() => onSubtopicChange(isActive ? '' : subtopic)}
              className="h-7 shrink-0 rounded-full px-3 text-xs"
            >
              {subtopic}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
