/**
 * Context Fusion Module
 * Combines text, vision, audio, and document contexts into unified representations
 * Enables modality-aware prompt construction for multi-modal AI agents
 */

import type { ImageContext } from "./vision.js";
import type { AudioContext } from "./audio.js";
import type { DocumentContext } from "./documents.js";

export interface MultiModalContext {
  text?: string;
  images?: ImageContext[];
  audio?: AudioContext[];
  documents?: DocumentContext[];
  timestamp: Date;
  priority: "high" | "medium" | "low";
  metadata?: Record<string, any>;
}

export interface FusedContext {
  unifiedText: string; // All modalities combined into text
  structuredData: {
    codeReferences: Array<{
      file: string;
      line?: number;
      snippet?: string;
      source: "text" | "image" | "audio" | "document";
    }>;
    requirements: Array<{
      id: string;
      description: string;
      source: "text" | "image" | "audio" | "document";
    }>;
    actionItems: Array<{
      task: string;
      priority: "high" | "medium" | "low";
      source: "text" | "image" | "audio" | "document";
    }>;
    visualReferences: Array<{
      description: string;
      imageIndex?: number;
      relevance: number;
    }>;
  };
  modalityBreakdown: {
    textTokens: number;
    imageCount: number;
    audioCount: number;
    documentCount: number;
  };
  confidence: number; // Overall confidence in fused context
}

export interface ModalityAwarePrompt {
  systemPrompt: string;
  userPrompt: string;
  images?: Array<{
    source: string; // URL or base64
    detail: "high" | "low" | "auto";
    purpose: string;
  }>;
  audioTranscripts?: Array<{
    text: string;
    role: "user" | "assistant" | "system";
    timestamp?: number;
  }>;
  documentExtracts?: Array<{
    text: string;
    source: string;
    relevance: number;
  }>;
  contextWindows: {
    primary: string; // Most important context
    secondary: string; // Supporting context
    background: string; // Optional background context
  };
}

/**
 * ContextFusion class - orchestrates multi-modal context combination
 */
export class ContextFusion {
  private visionEnabled: boolean;
  private audioEnabled: boolean;
  private documentEnabled: boolean;

  constructor(config?: {
    visionEnabled?: boolean;
    audioEnabled?: boolean;
    documentEnabled?: boolean;
  }) {
    this.visionEnabled = config?.visionEnabled ?? false;
    this.audioEnabled = config?.audioEnabled ?? false;
    this.documentEnabled = config?.documentEnabled ?? false;
  }

  /**
   * Fuse multiple modality contexts into unified representation
   */
  async fuseContexts(context: MultiModalContext): Promise<FusedContext> {
    const codeReferences: FusedContext["structuredData"]["codeReferences"] = [];
    const requirements: FusedContext["structuredData"]["requirements"] = [];
    const actionItems: FusedContext["structuredData"]["actionItems"] = [];
    const visualReferences: FusedContext["structuredData"]["visualReferences"] = [];

    let unifiedText = context.text || "";

    // Process images (if vision enabled)
    if (this.visionEnabled && context.images && context.images.length > 0) {
      unifiedText += "\n\n## Visual Context\n";
      context.images.forEach((img, idx) => {
        unifiedText += `Image ${idx + 1} (${img.purpose}): ${img.metadata.fileName || "unnamed"}\n`;
        if (img.annotations) {
          img.annotations.forEach((annotation) => {
            unifiedText += `- ${annotation.type}: ${annotation.description}\n`;
          });
        }
        visualReferences.push({
          description: `Image for ${img.purpose}`,
          imageIndex: idx,
          relevance: 0.8,
        });
      });
    }

    // Process audio (if audio enabled)
    if (this.audioEnabled && context.audio && context.audio.length > 0) {
      unifiedText += "\n\n## Audio Context\n";
      context.audio.forEach((audio, idx) => {
        if (audio.transcript) {
          unifiedText += `Audio ${idx + 1} (${audio.purpose}):\n${audio.transcript}\n\n`;
        } else {
          unifiedText += `Audio ${idx + 1} (${audio.purpose}): [Transcription pending]\n`;
        }
      });
    }

    // Process documents (if document enabled)
    if (this.documentEnabled && context.documents && context.documents.length > 0) {
      unifiedText += "\n\n## Document Context\n";
      context.documents.forEach((doc, idx) => {
        unifiedText += `Document ${idx + 1} (${doc.purpose}): ${doc.metadata.fileName}\n`;
        if (doc.extractedText) {
          unifiedText += `${doc.extractedText.substring(0, 500)}...\n\n`;
        }
      });
    }

    // Calculate token estimate (rough approximation)
    const textTokens = Math.ceil(unifiedText.length / 4);

    return {
      unifiedText,
      structuredData: {
        codeReferences,
        requirements,
        actionItems,
        visualReferences,
      },
      modalityBreakdown: {
        textTokens,
        imageCount: context.images?.length || 0,
        audioCount: context.audio?.length || 0,
        documentCount: context.documents?.length || 0,
      },
      confidence: this._calculateConfidence(context),
    };
  }

  /**
   * Construct modality-aware prompt for AI model
   */
  async constructPrompt(
    fusedContext: FusedContext,
    taskDescription: string,
    options?: {
      includeImages?: boolean;
      includeAudioTranscripts?: boolean;
      includeDocuments?: boolean;
      maxContextTokens?: number;
    }
  ): Promise<ModalityAwarePrompt> {
    const systemPrompt = this._buildSystemPrompt(fusedContext, options);
    const userPrompt = this._buildUserPrompt(fusedContext, taskDescription, options);

    return {
      systemPrompt,
      userPrompt,
      images: options?.includeImages ? this._extractImageReferences(fusedContext) : undefined,
      audioTranscripts: options?.includeAudioTranscripts
        ? this._extractAudioTranscripts(fusedContext)
        : undefined,
      documentExtracts: options?.includeDocuments
        ? this._extractDocumentSnippets(fusedContext)
        : undefined,
      contextWindows: {
        primary: taskDescription,
        secondary: fusedContext.unifiedText.substring(0, 2000),
        background: this._buildBackgroundContext(fusedContext),
      },
    };
  }

  /**
   * Prioritize modalities based on task type
   */
  prioritizeModalities(
    taskType: "code-review" | "bug-fix" | "feature" | "design-review" | "documentation"
  ): {
    vision: number; // 0-1 priority score
    audio: number;
    document: number;
    text: number;
  } {
    const priorities = {
      "code-review": { vision: 0.3, audio: 0.4, document: 0.2, text: 1.0 },
      "bug-fix": { vision: 0.6, audio: 0.2, document: 0.1, text: 1.0 },
      feature: { vision: 0.4, audio: 0.3, document: 0.8, text: 1.0 },
      "design-review": { vision: 0.9, audio: 0.3, document: 0.5, text: 0.7 },
      documentation: { vision: 0.5, audio: 0.2, document: 0.9, text: 1.0 },
    };

    return priorities[taskType];
  }

  private _calculateConfidence(context: MultiModalContext): number {
    let confidence = 0.5; // Base confidence

    if (context.text && context.text.length > 100) confidence += 0.2;
    if (context.images && context.images.length > 0) confidence += 0.1;
    if (context.audio && context.audio.length > 0) confidence += 0.1;
    if (context.documents && context.documents.length > 0) confidence += 0.1;

    return Math.min(confidence, 1.0);
  }

  private _buildSystemPrompt(fusedContext: FusedContext, options?: any): string {
    let prompt = "You are DevBot, an autonomous AI software engineer with multi-modal capabilities.\n\n";

    if (fusedContext.modalityBreakdown.imageCount > 0 && this.visionEnabled) {
      prompt += "You have access to visual context from screenshots and diagrams.\n";
    }
    if (fusedContext.modalityBreakdown.audioCount > 0 && this.audioEnabled) {
      prompt += "You have access to audio transcripts from meetings and code reviews.\n";
    }
    if (fusedContext.modalityBreakdown.documentCount > 0 && this.documentEnabled) {
      prompt += "You have access to requirement documents and specifications.\n";
    }

    prompt += "\nYour task is to analyze all available context and provide actionable insights.";

    return prompt;
  }

  private _buildUserPrompt(fusedContext: FusedContext, taskDescription: string, options?: any): string {
    let prompt = `Task: ${taskDescription}\n\n`;
    prompt += `Context:\n${fusedContext.unifiedText}\n\n`;

    if (fusedContext.structuredData.requirements.length > 0) {
      prompt += "Requirements:\n";
      fusedContext.structuredData.requirements.forEach((req) => {
        prompt += `- ${req.description} (from ${req.source})\n`;
      });
    }

    return prompt;
  }

  private _buildBackgroundContext(fusedContext: FusedContext): string {
    return `Total context: ${fusedContext.modalityBreakdown.textTokens} tokens, ${fusedContext.modalityBreakdown.imageCount} images, ${fusedContext.modalityBreakdown.audioCount} audio files, ${fusedContext.modalityBreakdown.documentCount} documents`;
  }

  private _extractImageReferences(fusedContext: FusedContext) {
    return fusedContext.structuredData.visualReferences.map((ref) => ({
      source: "placeholder-url",
      detail: "high" as const,
      purpose: ref.description,
    }));
  }

  private _extractAudioTranscripts(fusedContext: FusedContext) {
    return [
      {
        text: "Audio transcript placeholder",
        role: "user" as const,
      },
    ];
  }

  private _extractDocumentSnippets(fusedContext: FusedContext) {
    return [
      {
        text: "Document snippet placeholder",
        source: "document.pdf",
        relevance: 0.8,
      },
    ];
  }
}

/**
 * Factory function to create ContextFusion instance
 */
export function createContextFusion(config?: {
  visionEnabled?: boolean;
  audioEnabled?: boolean;
  documentEnabled?: boolean;
}): ContextFusion {
  return new ContextFusion(config);
}
