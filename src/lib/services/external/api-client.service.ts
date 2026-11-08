export interface ExternalDocument {
  id: string;
  content: string;
  source: string;
  metadata: Record<string, unknown>;
  timestamp: Date;
  title?: string;
}

export class ExternalAPIService {
  async fetchExternalData(_query?: string): Promise<ExternalDocument[]> {
    return [];
  }

  async keywordSearch(
    _query?: string,
    _limit?: number
  ): Promise<ExternalDocument[]> {
    return [];
  }
}

export class ExternalAPIClient extends ExternalAPIService {}
