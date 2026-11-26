export const TWK_SUBTOPICS = [
  'Nasionalisme',
  'Integritas',
  'Bela Negara',
  'Pilar Negara - Pancasila',
  'Pilar Negara - UUD NRI 1945',
  'Pilar Negara - NKRI',
  'Pilar Negara - Bhinneka Tunggal Ika',
  'Bahasa Indonesia',
  'Sejarah Kebangsaan',
] as const;

export interface MaterialSummary {
  id: string;
  slug: string;
  title: string;
  category: 'TWK';
  subtopic: string;
  summary: string;
  sourceType: string;
  sourceUrl: string | null;
  linkedQuestionCount: number;
  mistakeCount: number;
  updatedAt: string;
}

export interface MaterialDetail extends MaterialSummary {
  contentMarkdown: string;
  linkedQuestionSlugs: string[];
}

export interface PreloadedMaterialData {
  slug: string;
  title: string;
  subtopic: string;
  summary?: string;
  contentMarkdown: string;
  sourceUrl?: string | null;
  linkedQuestionCount?: number;
  mistakeCount?: number;
}

export function readGuestChatIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('skd_guest_chat_ids');
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}
