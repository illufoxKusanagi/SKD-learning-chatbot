'use client';

import type { ComponentType } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { AlertTriangle, BookOpen, GitBranch, Sparkles } from 'lucide-react';

interface SectionConfig {
  heading: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  cardClass: string;
  iconClass: string;
}

const HOTS_SECTIONS: readonly SectionConfig[] = [
  {
    heading: '## Inti Konsep',
    label: 'Inti Konsep',
    icon: BookOpen,
    cardClass: '',
    iconClass: 'text-primary',
  },
  {
    heading: '## Logika Sebab-Akibat',
    label: 'Logika Sebab-Akibat',
    icon: GitBranch,
    cardClass: '',
    iconClass: 'text-primary',
  },
  {
    heading: '## Jembatan Soal HOTS',
    label: 'Jembatan Soal HOTS',
    icon: Sparkles,
    cardClass: 'border-primary/30 bg-primary/5',
    iconClass: 'text-primary',
  },
  {
    heading: '## Jebakan Klasik',
    label: 'Jebakan Klasik',
    icon: AlertTriangle,
    cardClass: 'border-warning/40 bg-warning/5',
    iconClass: 'text-warning',
  },
];

interface ParsedSection {
  config: SectionConfig;
  body: string;
}

function splitHotsSections(markdown: string): {
  intro: string;
  sections: ParsedSection[];
} {
  const normalized = markdown.replace(/\r\n/g, '\n').trim();
  const matches: Array<{ index: number; config: SectionConfig }> = [];

  for (const config of HOTS_SECTIONS) {
    const regex = new RegExp(
      `^${config.heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`,
      'm'
    );
    const match = regex.exec(normalized);
    if (match && typeof match.index === 'number') {
      matches.push({ index: match.index, config });
    }
  }

  if (matches.length === 0) {
    return { intro: normalized, sections: [] };
  }

  matches.sort((a, b) => a.index - b.index);
  const intro = normalized.slice(0, matches[0].index).trim();
  const sections: ParsedSection[] = [];

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const next = matches[i + 1];
    const startAfterHeading =
      normalized.indexOf('\n', current.index) === -1
        ? normalized.length
        : normalized.indexOf('\n', current.index) + 1;
    const end = next ? next.index : normalized.length;
    const body = normalized.slice(startAfterHeading, end).trim();
    if (body) {
      sections.push({ config: current.config, body });
    }
  }

  return { intro, sections };
}

function MarkdownBody({ content }: { content: string }) {
  return (
    <div className="flex flex-col gap-2 text-sm leading-relaxed text-foreground">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h3: ({ ...props }) => (
            <h3 className="mt-2 text-sm font-semibold text-foreground" {...props} />
          ),
          p: ({ ...props }) => (
            <p className="leading-relaxed text-foreground" {...props} />
          ),
          ul: ({ ...props }) => (
            <ul className="flex list-disc flex-col gap-1 pl-5" {...props} />
          ),
          ol: ({ ...props }) => (
            <ol className="flex list-decimal flex-col gap-1 pl-5" {...props} />
          ),
          li: ({ ...props }) => <li className="leading-relaxed" {...props} />,
          blockquote: ({ ...props }) => (
            <blockquote
              className="border-l-2 border-primary/50 pl-3 text-muted-foreground italic"
              {...props}
            />
          ),
          code: ({ className, children, ...props }) => (
            <code
              className={cn(
                'rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground',
                className
              )}
              {...props}
            >
              {children}
            </code>
          ),
          a: ({ ...props }) => (
            <a
              className="font-medium text-primary underline underline-offset-4 hover:text-primary/80"
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export function MaterialMarkdownViewer({
  contentMarkdown,
  className,
}: {
  contentMarkdown: string;
  className?: string;
}) {
  const { intro, sections } = splitHotsSections(contentMarkdown);

  if (sections.length === 0) {
    return (
      <Card className={cn('gap-3 py-4 shadow-none', className)}>
        <CardContent className="px-4 sm:px-5">
          <MarkdownBody content={contentMarkdown} />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {intro && (
        <Card className="gap-2 py-4 shadow-none">
          <CardContent className="px-4 sm:px-5">
            <MarkdownBody content={intro} />
          </CardContent>
        </Card>
      )}

      {sections.map(({ config, body }) => {
        const Icon = config.icon;
        return (
          <Card
            key={config.heading}
            className={cn('gap-2 py-4 shadow-none', config.cardClass)}
          >
            <CardHeader className="px-4 pb-1 sm:px-5">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Icon className={cn('size-4 shrink-0', config.iconClass)} />
                <span>{config.label}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 sm:px-5">
              <MarkdownBody content={body} />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
