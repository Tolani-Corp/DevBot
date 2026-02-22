/**
 * Mock factories for multi-modal testing
 * Provides test data for vision, audio, and document analysis
 */

import type {
  ImageContext,
  ImageMetadata,
  ScreenshotAnalysis,
  UIIssue,
  OCRResult,
  DesignComparison,
} from "../src/multimodal/vision.js";

import type {
  AudioContext,
  AudioMetadata,
  TranscriptionResult,
  CodeExplanationAnalysis,
  AudioReport,
} from "../src/multimodal/audio.js";

import type {
  DocumentContext,
  DocumentMetadata,
  PDFAnalysis,
  ExcelAnalysis,
  DiagramAnalysis,
  Requirement,
} from "../src/multimodal/documents.js";

import type {
  MultiModalContext,
  FusedContext,
  ModalityAwarePrompt,
} from "../src/multimodal/context-fusion.js";

// ==================== Image/Vision Mocks ====================

export function createMockImageMetadata(overrides?: Partial<ImageMetadata>): ImageMetadata {
  return {
    url: "https://example.com/screenshot.png",
    fileName: "test-screenshot.png",
    timestamp: new Date("2026-02-22T10:00:00Z"),
    source: "screenshot",
    dimensions: { width: 1920, height: 1080 },
    format: "png",
    ...overrides,
  };
}

export function createMockImageContext(overrides?: Partial<ImageContext>): ImageContext {
  return {
    metadata: createMockImageMetadata(),
    purpose: "ui-analysis",
    annotations: [
      {
        type: "issue",
        coordinates: { x: 100, y: 200, width: 300, height: 50 },
        description: "Button contrast too low",
      },
    ],
    ...overrides,
  };
}

export function createMockUIIssue(overrides?: Partial<UIIssue>): UIIssue {
  return {
    severity: "medium",
    category: "accessibility",
    description: "Insufficient color contrast for text",
    location: "Login button",
    suggestion: "Increase contrast ratio to meet WCAG AA standards",
    wcagViolation: "WCAG 2.1 Level AA - 1.4.3 Contrast (Minimum)",
    ...overrides,
  };
}

export function createMockScreenshotAnalysis(overrides?: Partial<ScreenshotAnalysis>): ScreenshotAnalysis {
  return {
    detectedElements: [
      { type: "button", text: "Submit", confidence: 0.95, bounds: { x: 100, y: 200, width: 80, height: 40 } },
      { type: "input", text: "", confidence: 0.88, bounds: { x: 100, y: 150, width: 200, height: 30 } },
    ],
    issues: [createMockUIIssue()],
    summary: "Detected 2 UI elements with 1 accessibility issue",
    suggestions: ["Improve button contrast", "Add ARIA labels to inputs"],
    ...overrides,
  };
}

export function createMockOCRResult(overrides?: Partial<OCRResult>): OCRResult {
  return {
    text: "Sample text extracted from image",
    confidence: 0.92,
    regions: [
      {
        text: "Sample text",
        bounds: { x: 50, y: 50, width: 200, height: 30 },
        confidence: 0.94,
      },
    ],
    language: "en",
    ...overrides,
  };
}

export function createMockDesignComparison(overrides?: Partial<DesignComparison>): DesignComparison {
  return {
    matchScore: 0.85,
    differences: [
      {
        type: "color",
        severity: "medium",
        description: "Primary button color differs from design",
        location: "Header navigation",
      },
      {
        type: "spacing",
        severity: "low",
        description: "Padding is 8px instead of 12px",
        location: "Container margins",
      },
    ],
    designImage: createMockImageContext({ purpose: "design-review" }),
    implementationImage: createMockImageContext({ purpose: "ui-analysis" }),
    ...overrides,
  };
}

// ==================== Audio Mocks ====================

export function createMockAudioMetadata(overrides?: Partial<AudioMetadata>): AudioMetadata {
  return {
    url: "https://example.com/code-review.mp3",
    fileName: "standup-2026-02-22.mp3",
    duration: 180, // 3 minutes
    format: "mp3",
    sampleRate: 44100,
    channels: 2,
    timestamp: new Date("2026-02-22T09:00:00Z"),
    source: "microphone",
    ...overrides,
  };
}

export function createMockAudioContext(overrides?: Partial<AudioContext>): AudioContext {
  return {
    metadata: createMockAudioMetadata(),
    purpose: "code-review",
    transcript: "Let's review the authentication module. I noticed the JWT validation is missing expiry checks.",
    language: "en",
    ...overrides,
  };
}

export function createMockTranscriptionResult(overrides?: Partial<TranscriptionResult>): TranscriptionResult {
  return {
    text: "Let's review the authentication module. I noticed the JWT validation is missing expiry checks.",
    confidence: 0.94,
    segments: [
      { text: "Let's review the authentication module.", start: 0, end: 2.5, confidence: 0.96 },
      { text: "I noticed the JWT validation is missing expiry checks.", start: 2.5, end: 5.8, confidence: 0.92 },
    ],
    language: "en",
    speakerCount: 1,
    ...overrides,
  };
}

export function createMockCodeExplanationAnalysis(
  overrides?: Partial<CodeExplanationAnalysis>
): CodeExplanationAnalysis {
  return {
    transcript: createMockTranscriptionResult(),
    detectedIssues: [
      {
        severity: "high",
        type: "security",
        description: "JWT validation missing expiry checks",
        timestamp: 3.5,
      },
    ],
    actionItems: [
      {
        task: "Add JWT expiry validation to authentication module",
        priority: "high",
        timestamp: 3.5,
      },
    ],
    codeReferences: [
      {
        file: "src/auth/jwt.ts",
        function: "validateToken",
        line: 42,
        description: "Missing expiry check",
        timestamp: 3.5,
      },
    ],
    summary: "Code review identified 1 security issue in JWT validation",
    ...overrides,
  };
}

export function createMockAudioReport(overrides?: Partial<AudioReport>): AudioReport {
  return {
    text: "Daily standup report: Team completed 5 tasks, 3 in progress, 2 blockers identified.",
    audioMetadata: {
      format: "mp3",
      duration: 45,
      voice: "neutral",
      speed: 1.0,
    },
    generatedUrl: "https://example.com/reports/standup-2026-02-22.mp3",
    ...overrides,
  };
}

// ==================== Document Mocks ====================

export function createMockDocumentMetadata(overrides?: Partial<DocumentMetadata>): DocumentMetadata {
  return {
    url: "https://example.com/requirements.pdf",
    fileName: "project-requirements-v2.pdf",
    fileSize: 2048000, // 2MB
    mimeType: "application/pdf",
    timestamp: new Date("2026-02-20T14:00:00Z"),
    source: "upload",
    ...overrides,
  };
}

export function createMockDocumentContext(overrides?: Partial<DocumentContext>): DocumentContext {
  return {
    metadata: createMockDocumentMetadata(),
    purpose: "requirements",
    extractedText: "Project Requirements Document\n\n1. User authentication with OAuth2\n2. Real-time notifications",
    pageCount: 15,
    ...overrides,
  };
}

export function createMockRequirement(overrides?: Partial<Requirement>): Requirement {
  return {
    id: "REQ-001",
    type: "functional",
    priority: "must-have",
    description: "Users must authenticate using OAuth2 (Google, GitHub)",
    acceptanceCriteria: [
      "OAuth2 flow completes successfully",
      "User profile data is stored securely",
      "Session expires after 24 hours",
    ],
    source: {
      document: "project-requirements-v2.pdf",
      page: 3,
      section: "Authentication",
    },
    estimatedEffort: "medium",
    ...overrides,
  };
}

export function createMockPDFAnalysis(overrides?: Partial<PDFAnalysis>): PDFAnalysis {
  return {
    text: "Full PDF text content...",
    pages: [
      { pageNumber: 1, text: "Cover page", images: 1, tables: 0 },
      { pageNumber: 2, text: "Table of contents", images: 0, tables: 1 },
      { pageNumber: 3, text: "Requirements section", images: 0, tables: 2 },
    ],
    requirements: [createMockRequirement()],
    metadata: {
      title: "Project Requirements Document",
      author: "Product Team",
      creationDate: new Date("2026-02-15"),
      pageCount: 15,
    },
    summary: "Requirements document specifying OAuth2 authentication, real-time notifications, and 12 other features",
    ...overrides,
  };
}

export function createMockExcelAnalysis(overrides?: Partial<ExcelAnalysis>): ExcelAnalysis {
  return {
    sheets: [
      { name: "Users", rows: 100, columns: 5, hasHeaders: true, sampleData: [["id", "name", "email", "role", "created_at"]] },
      { name: "Orders", rows: 250, columns: 7, hasHeaders: true },
    ],
    detectedDataModel: {
      entities: [
        {
          name: "User",
          fields: [
            { name: "id", type: "number", required: true, unique: true },
            { name: "name", type: "string", required: true },
            { name: "email", type: "string", required: true, unique: true },
            { name: "role", type: "string", required: true },
          ],
        },
      ],
      relationships: [],
    },
    summary: "Excel workbook contains user and order data with detected schema",
    suggestions: ["Add foreign key from Orders to Users", "Consider normalizing role into separate table"],
    ...overrides,
  };
}

export function createMockDiagramAnalysis(overrides?: Partial<DiagramAnalysis>): DiagramAnalysis {
  return {
    type: "architecture",
    components: [
      { id: "frontend", type: "web-app", label: "React Frontend" },
      { id: "api", type: "api-gateway", label: "API Gateway" },
      { id: "auth", type: "service", label: "Auth Service" },
      { id: "db", type: "database", label: "PostgreSQL" },
    ],
    connections: [
      { from: "frontend", to: "api", type: "https", label: "API calls" },
      { from: "api", to: "auth", type: "internal", label: "Authentication" },
      { from: "auth", to: "db", type: "sql", label: "User data" },
    ],
    layers: [
      { name: "Presentation", components: ["frontend"] },
      { name: "Application", components: ["api", "auth"] },
      { name: "Data", components: ["db"] },
    ],
    technologies: ["React", "Node.js", "PostgreSQL", "JWT"],
    summary: "Three-tier architecture with React frontend, Node.js backend, and PostgreSQL database",
    implementationGuidance: [
      "Set up API Gateway with rate limiting",
      "Implement JWT authentication in Auth Service",
      "Configure PostgreSQL connection pooling",
    ],
    ...overrides,
  };
}

// ==================== Context Fusion Mocks ====================

export function createMockMultiModalContext(overrides?: Partial<MultiModalContext>): MultiModalContext {
  return {
    text: "User reported login button not working on mobile devices",
    images: [createMockImageContext()],
    audio: [createMockAudioContext()],
    documents: [createMockDocumentContext()],
    timestamp: new Date("2026-02-22T10:00:00Z"),
    priority: "high",
    metadata: { issueId: "BUG-123", reporter: "user@example.com" },
    ...overrides,
  };
}

export function createMockFusedContext(overrides?: Partial<FusedContext>): FusedContext {
  return {
    unifiedText: "Combined context from all modalities:\n\nText: User reported login issue\nImage: Screenshot shows contrast issue\nAudio: Code review mentioned auth bugs\nDocument: Requirements specify OAuth2",
    structuredData: {
      codeReferences: [
        { file: "src/auth/login.ts", line: 42, snippet: "validateCredentials()", source: "audio" },
      ],
      requirements: [
        { id: "REQ-001", description: "OAuth2 authentication", source: "document" },
      ],
      actionItems: [
        { task: "Fix login button contrast", priority: "high", source: "image" },
      ],
      visualReferences: [
        { description: "Login page screenshot", imageIndex: 0, relevance: 0.9 },
      ],
    },
    modalityBreakdown: {
      textTokens: 450,
      imageCount: 1,
      audioCount: 1,
      documentCount: 1,
    },
    confidence: 0.88,
    ...overrides,
  };
}

export function createMockModalityAwarePrompt(overrides?: Partial<ModalityAwarePrompt>): ModalityAwarePrompt {
  return {
    systemPrompt: "You are DevBot with multi-modal capabilities. Analyze all provided context.",
    userPrompt: "Fix the login button issue on mobile devices",
    images: [
      { source: "https://example.com/screenshot.png", detail: "high", purpose: "Bug detection" },
    ],
    audioTranscripts: [
      { text: "The login flow has validation issues", role: "user" },
    ],
    documentExtracts: [
      { text: "OAuth2 must support Google and GitHub", source: "requirements.pdf", relevance: 0.8 },
    ],
    contextWindows: {
      primary: "Fix login button on mobile",
      secondary: "Multiple context sources indicate auth issues",
      background: "Total context: 450 tokens, 1 image, 1 audio, 1 document",
    },
    ...overrides,
  };
}
