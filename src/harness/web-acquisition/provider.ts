import type {
  AcquisitionProviderKind,
  DataClassification,
  WebAcquisitionMission,
} from "./types.js";

export interface SearchRequest {
  query: string;
  limit: number;
  allowedDomains?: string[];
  freshnessDays?: number;
}

export interface ScrapeRequest {
  url: string;
  formats: Array<"markdown" | "html" | "json" | "screenshot" | "links">;
  timeoutMs: number;
  waitForMs?: number;
}

export interface CrawlRequest {
  startUrl: string;
  maxPages: number;
  maxDepth: number;
  includePaths?: string[];
  excludePaths?: string[];
  formats: Array<"markdown" | "html" | "json" | "screenshot" | "links">;
}

export interface BrowserInteractionRequest {
  startUrl: string;
  actions: Array<
    | { type: "wait"; milliseconds: number }
    | { type: "click"; selector: string }
    | { type: "type"; selector: string; text: string }
    | { type: "extract"; selector?: string }
    | { type: "screenshot" }
  >;
  timeoutMs: number;
}

export interface AcquiredDocument {
  url: string;
  canonicalUrl?: string;
  title?: string;
  markdown?: string;
  html?: string;
  json?: unknown;
  links?: string[];
  screenshotUrl?: string;
  statusCode?: number;
  contentHash?: string;
  retrievedAt: string;
  provider: AcquisitionProviderKind;
  dataClassification: DataClassification;
  provenance: {
    missionId: string;
    sourceUrl: string;
    retrievedAt: string;
    providerRequestId?: string;
  };
}

export interface AcquisitionUsage {
  pages: number;
  providerCredits: number;
  browserMinutes: number;
  toolCalls: number;
  costUsd: number;
}

export interface ProviderResult<T> {
  requestId: string;
  data: T;
  usage: AcquisitionUsage;
  warnings: string[];
}

export interface WebAcquisitionProvider {
  readonly kind: AcquisitionProviderKind;
  healthCheck(): Promise<{ healthy: boolean; detail?: string }>;
  search(
    mission: WebAcquisitionMission,
    request: SearchRequest,
  ): Promise<ProviderResult<AcquiredDocument[]>>;
  scrape(
    mission: WebAcquisitionMission,
    request: ScrapeRequest,
  ): Promise<ProviderResult<AcquiredDocument>>;
  crawl(
    mission: WebAcquisitionMission,
    request: CrawlRequest,
  ): Promise<ProviderResult<AcquiredDocument[]>>;
  interact(
    mission: WebAcquisitionMission,
    request: BrowserInteractionRequest,
  ): Promise<ProviderResult<AcquiredDocument>>;
  cancel(requestId: string): Promise<void>;
}

export interface ProviderRegistry {
  register(provider: WebAcquisitionProvider): void;
  get(kind: AcquisitionProviderKind): WebAcquisitionProvider | undefined;
  list(): AcquisitionProviderKind[];
}

export class InMemoryProviderRegistry implements ProviderRegistry {
  private readonly providers = new Map<AcquisitionProviderKind, WebAcquisitionProvider>();

  register(provider: WebAcquisitionProvider): void {
    if (this.providers.has(provider.kind)) {
      throw new Error(`Provider already registered: ${provider.kind}`);
    }
    this.providers.set(provider.kind, provider);
  }

  get(kind: AcquisitionProviderKind): WebAcquisitionProvider | undefined {
    return this.providers.get(kind);
  }

  list(): AcquisitionProviderKind[] {
    return [...this.providers.keys()];
  }
}
