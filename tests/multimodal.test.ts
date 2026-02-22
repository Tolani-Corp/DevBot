/**
 * Multi-Modal Tests
 * Tests for vision, audio, document analysis, and context fusion
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createVisionAnalyzer } from "../src/multimodal/vision.js";
import { createAudioAnalyzer } from "../src/multimodal/audio.js";
import { createDocumentAnalyzer } from "../src/multimodal/documents.js";
import { ContextFusion } from "../src/multimodal/context-fusion.js";
import {
  createMockImageContext,
  createMockAudioContext,
  createMockDocumentContext,
  createMockMultiModalContext,
} from "./helpers/mock-multimodal.js";

describe("Vision Analyzer", () => {
  it("should analyze screenshot and detect UI elements", async () => {
    const analyzer = createVisionAnalyzer();
    const imageContext = createMockImageContext({ purpose: "ui-analysis" });

    const result = await analyzer.analyzeScreenshot(imageContext);

    expect(result).toBeDefined();
    expect(result.detectedElements).toBeInstanceOf(Array);
    expect(result.issues).toBeInstanceOf(Array);
    expect(result.summary).toBeTruthy();
  });

  it("should detect UI issues in screenshot", async () => {
    const analyzer = createVisionAnalyzer();
    const imageContext = createMockImageContext({ purpose: "accessibility" });

    const issues = await analyzer.detectUIIssues(imageContext);

    expect(issues).toBeInstanceOf(Array);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]).toHaveProperty("severity");
    expect(issues[0]).toHaveProperty("category");
  });

  it("should extract text from image using OCR", async () => {
    const analyzer = createVisionAnalyzer();
    const imageContext = createMockImageContext({ purpose: "ocr" });

    const result = await analyzer.extractTextFromImage(imageContext);

    expect(result).toBeDefined();
    expect(result).toHaveProperty("text");
    expect(result).toHaveProperty("confidence");
    expect(result.regions).toBeInstanceOf(Array);
  });

  it("should compare design with implementation", async () => {
    const analyzer = createVisionAnalyzer();
    const designImage = createMockImageContext({ purpose: "design-review" });
    const implImage = createMockImageContext({ purpose: "ui-analysis" });

    const comparison = await analyzer.compareDesignWithImplementation(designImage, implImage);

    expect(comparison).toBeDefined();
    expect(comparison).toHaveProperty("matchScore");
    expect(comparison.differences).toBeInstanceOf(Array);
  });

  it("should generate accessibility report", async () => {
    const analyzer = createVisionAnalyzer();
    const imageContext = createMockImageContext({ purpose: "accessibility" });

    const report = await analyzer.generateAccessibilityReport(imageContext);

    expect(report).toBeDefined();
    expect(report).toHaveProperty("score");
    expect(report).toHaveProperty("wcagLevel");
    expect(report.issues).toBeInstanceOf(Array);
  });
});

describe("Audio Analyzer", () => {
  it("should transcribe audio to text", async () => {
    const analyzer = createAudioAnalyzer();
    const audioContext = createMockAudioContext({ purpose: "transcription" });

    const result = await analyzer.transcribeAudio(audioContext);

    expect(result).toBeDefined();
    expect(result).toHaveProperty("text");
    expect(result).toHaveProperty("confidence");
    expect(result.segments).toBeInstanceOf(Array);
  });

  it("should analyze code explanation from audio", async () => {
    const analyzer = createAudioAnalyzer();
    const audioContext = createMockAudioContext({ purpose: "code-review" });

    const analysis = await analyzer.analyzeCodeExplanation(audioContext);

    expect(analysis).toBeDefined();
    expect(analysis.detectedIssues).toBeInstanceOf(Array);
    expect(analysis.actionItems).toBeInstanceOf(Array);
    expect(analysis.codeReferences).toBeInstanceOf(Array);
  });

  it("should generate audio report", async () => {
    const analyzer = createAudioAnalyzer();
    const text = "Daily standup summary: 3 tasks completed, 2 blockers identified.";

    const report = await analyzer.generateAudioReport(text, { voice: "neutral", speed: 1.0 });

    expect(report).toBeDefined();
    expect(report.text).toBe(text);
    expect(report.audioMetadata).toBeDefined();
  });

  it("should extract action items from audio", async () => {
    const analyzer = createAudioAnalyzer();
    const audioContext = createMockAudioContext({ purpose: "standup" });

    const actionItems = await analyzer.extractActionItems(audioContext);

    expect(actionItems).toBeInstanceOf(Array);
    expect(actionItems.length).toBeGreaterThan(0);
    expect(actionItems[0]).toHaveProperty("task");
    expect(actionItems[0]).toHaveProperty("priority");
  });

  it("should analyze sentiment in audio", async () => {
    const analyzer = createAudioAnalyzer();
    const audioContext = createMockAudioContext({ purpose: "code-review" });

    const sentiment = await analyzer.analyzeSentiment(audioContext);

    expect(sentiment).toBeDefined();
    expect(sentiment).toHaveProperty("overall");
    expect(sentiment.segments).toBeInstanceOf(Array);
  });
});

describe("Document Analyzer", () => {
  it("should analyze PDF and extract requirements", async () => {
    const analyzer = createDocumentAnalyzer();
    const docContext = createMockDocumentContext({ purpose: "requirements" });

    const analysis = await analyzer.analyzePDF(docContext);

    expect(analysis).toBeDefined();
    expect(analysis.pages).toBeInstanceOf(Array);
    expect(analysis.requirements).toBeInstanceOf(Array);
    expect(analysis.metadata).toBeDefined();
  });

  it("should analyze Excel and detect data model", async () => {
    const analyzer = createDocumentAnalyzer();
    const docContext = createMockDocumentContext({
      purpose: "data-model",
      metadata: {
        fileName: "database-schema.xlsx",
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        timestamp: new Date(),
        source: "upload",
      },
    });

    const analysis = await analyzer.analyzeExcel(docContext);

    expect(analysis).toBeDefined();
    expect(analysis.sheets).toBeInstanceOf(Array);
    expect(analysis.suggestions).toBeInstanceOf(Array);
  });

  it("should analyze architecture diagram", async () => {
    const analyzer = createDocumentAnalyzer();
    const docContext = createMockDocumentContext({ purpose: "diagram" });

    const analysis = await analyzer.analyzeDiagram(docContext);

    expect(analysis).toBeDefined();
    expect(analysis.components).toBeInstanceOf(Array);
    expect(analysis.connections).toBeInstanceOf(Array);
    expect(analysis).toHaveProperty("type");
  });

  it("should extract requirements from document", async () => {
    const analyzer = createDocumentAnalyzer();
    const docContext = createMockDocumentContext({ purpose: "requirements" });

    const requirements = await analyzer.extractRequirements(docContext);

    expect(requirements).toBeInstanceOf(Array);
    expect(requirements.length).toBeGreaterThan(0);
    expect(requirements[0]).toHaveProperty("id");
    expect(requirements[0]).toHaveProperty("type");
    expect(requirements[0]).toHaveProperty("priority");
  });

  it("should convert document to tasks", async () => {
    const analyzer = createDocumentAnalyzer();
    const docContext = createMockDocumentContext({ purpose: "specifications" });

    const tasks = await analyzer.documentToTasks(docContext);

    expect(tasks).toBeInstanceOf(Array);
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks[0]).toHaveProperty("title");
    expect(tasks[0]).toHaveProperty("type");
  });

  it("should compare two document versions", async () => {
    const analyzer = createDocumentAnalyzer();
    const oldDoc = createMockDocumentContext({
      metadata: {
        fileName: "requirements-v1.pdf",
        timestamp: new Date("2026-02-01"),
        source: "upload",
      },
    });
    const newDoc = createMockDocumentContext({
      metadata: {
        fileName: "requirements-v2.pdf",
        timestamp: new Date("2026-02-20"),
        source: "upload",
      },
    });

    const comparison = await analyzer.compareDocuments(oldDoc, newDoc);

    expect(comparison).toBeDefined();
    expect(comparison.addedRequirements).toBeInstanceOf(Array);
    expect(comparison.removedRequirements).toBeInstanceOf(Array);
    expect(comparison.modifiedRequirements).toBeInstanceOf(Array);
  });
});

describe("Context Fusion", () => {
  let fusion: ContextFusion;

  beforeEach(() => {
    fusion = new ContextFusion({
      visionEnabled: true,
      audioEnabled: true,
      documentEnabled: true,
    });
  });

  it("should fuse multi-modal contexts", async () => {
    const context = createMockMultiModalContext();

    const fused = await fusion.fuseContexts(context);

    expect(fused).toBeDefined();
    expect(fused.unifiedText).toBeTruthy();
    expect(fused.structuredData).toBeDefined();
    expect(fused.modalityBreakdown.textTokens).toBeGreaterThan(0);
    expect(fused.confidence).toBeGreaterThan(0);
  });

  it("should construct modality-aware prompt", async () => {
    const context = createMockMultiModalContext();
    const fused = await fusion.fuseContexts(context);

    const prompt = await fusion.constructPrompt(fused, "Fix login button issue", {
      includeImages: true,
      includeAudioTranscripts: true,
      includeDocuments: true,
    });

    expect(prompt).toBeDefined();
    expect(prompt.systemPrompt).toBeTruthy();
    expect(prompt.userPrompt).toBeTruthy();
    expect(prompt.contextWindows).toBeDefined();
  });

  it("should prioritize modalities based on task type", () => {
    const priorities = fusion.prioritizeModalities("bug-fix");

    expect(priorities).toBeDefined();
    expect(priorities.vision).toBeGreaterThan(0);
    expect(priorities.audio).toBeGreaterThanOrEqual(0);
    expect(priorities.document).toBeGreaterThanOrEqual(0);
    expect(priorities.text).toBe(1.0);
  });

  it("should handle text-only context", async () => {
    const context = createMockMultiModalContext({
      images: undefined,
      audio: undefined,
      documents: undefined,
    });

    const fused = await fusion.fuseContexts(context);

    expect(fused).toBeDefined();
    expect(fused.modalityBreakdown.imageCount).toBe(0);
    expect(fused.modalityBreakdown.audioCount).toBe(0);
    expect(fused.modalityBreakdown.documentCount).toBe(0);
  });

  it("should calculate appropriate confidence scores", async () => {
    const richContext = createMockMultiModalContext();
    const richFused = await fusion.fuseContexts(richContext);

    const textOnlyContext = createMockMultiModalContext({
      images: undefined,
      audio: undefined,
      documents: undefined,
    });
    const textOnlyFused = await fusion.fuseContexts(textOnlyContext);

    expect(richFused.confidence).toBeGreaterThan(textOnlyFused.confidence);
  });
});
