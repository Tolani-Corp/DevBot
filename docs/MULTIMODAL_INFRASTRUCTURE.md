# Multi-Modal Infrastructure Documentation

## Overview
This document describes DevBot's multi-modal capabilities infrastructure, including vision analysis, audio processing, document analysis, and context fusion.

**Status**: Scaffolded and ready for API integration  
**Last Updated**: 2026-02-22

## Architecture

### Core Modules

1. **Vision Analysis** (`src/multimodal/vision.ts`)
   - Screenshot analysis and UI bug detection
   - Accessibility scanning (WCAG compliance)
   - Design-to-implementation comparison
   - OCR text extraction
   - Error screenshot diagnosis

2. **Audio Analysis** (`src/multimodal/audio.ts`)
   - Speech-to-text transcription
   - Code review audio analysis
   - Meeting action item extraction
   - Sentiment analysis
   - Text-to-speech report generation

3. **Document Analysis** (`src/multimodal/documents.ts`)
   - PDF requirement extraction
   - Excel data model detection
   - Architecture diagram parsing
   - Specification document comparison
   - Automated task generation from docs

4. **Context Fusion** (`src/multimodal/context-fusion.ts`)
   - Multi-modal context combination
   - Modality-aware prompt construction
   - Task-specific modality prioritization
   - Unified context representation

## Integration Points

### AgentTask Type Extension
The `AgentTask` interface now includes:
```typescript
interface AgentTask {
  // ... existing fields
  imageContext?: ImageContext[];
  audioContext?: AudioContext[];
  documentContext?: DocumentContext[];
}
```

### Orchestrator Integration
```typescript
import { ContextFusion } from "@/multimodal/index.js";

// In orchestrator or agent execution
const fusion = new ContextFusion({
  visionEnabled: true,
  audioEnabled: true,
  documentEnabled: true,
});

const fusedContext = await fusion.fuseContexts({
  text: task.description,
  images: task.imageContext,
  audio: task.audioContext,
  documents: task.documentContext,
  timestamp: new Date(),
  priority: "high",
});

const prompt = await fusion.constructPrompt(fusedContext, task.description);
// Use prompt with Claude API
```

## Configuration

### Environment Variables
```bash
# Vision API
VISION_API_KEY=your-claude-api-key
VISION_PROVIDER=claude  # claude | openai | azure-vision

# Audio API
AUDIO_API_KEY=your-whisper-api-key
AUDIO_PROVIDER=whisper  # whisper | azure-speech | google-speech

# Document API
DOCUMENT_API_KEY=your-api-key
DOCUMENT_PROVIDER=claude  # claude | gpt4v | azure-document-intelligence

# Feature Flags
MULTIMODAL_VISION_ENABLED=false
MULTIMODAL_AUDIO_ENABLED=false
MULTIMODAL_DOCUMENTS_ENABLED=false
```

### Configuration File
`.devbot/multimodal-config.json` defines:
- API providers and endpoints
- Feature toggles for each modality
- File size and format limits
- Storage configuration
- Security settings

## Activation Roadmap

### Phase 1: Vision Integration (Week 1-2)
1. **Setup Claude Vision API**
   ```typescript
   // Replace MockVisionAnalyzer with:
   import Anthropic from "@anthropic-ai/sdk";
   
   class ClaudeVisionAnalyzer implements VisionAnalyzer {
     private client: Anthropic;
     
     constructor(apiKey: string) {
       this.client = new Anthropic({ apiKey });
     }
     
     async analyzeScreenshot(image: ImageContext) {
       const response = await this.client.messages.create({
         model: "claude-3-5-sonnet-20241022",
         max_tokens: 1024,
         messages: [{
           role: "user",
           content: [
             {
               type: "image",
               source: {
                 type: image.metadata.base64 ? "base64" : "url",
                 media_type: `image/${image.metadata.format}`,
                 data: image.metadata.base64 || image.metadata.url,
               },
             },
             {
               type: "text",
               text: "Analyze this UI screenshot for bugs, accessibility issues, and layout problems. Return structured JSON.",
             },
           ],
         }],
       });
       // Parse and return ScreenshotAnalysis
     }
   }
   ```

2. **Update Factory Function**
   ```typescript
   export function createVisionAnalyzer(config?: {
     apiKey?: string;
     provider?: "claude" | "openai" | "custom";
   }): VisionAnalyzer {
     if (!config?.apiKey || !process.env.MULTIMODAL_VISION_ENABLED) {
       return new MockVisionAnalyzer();
     }
     
     if (config.provider === "claude") {
       return new ClaudeVisionAnalyzer(config.apiKey);
     }
     // Add other providers as needed
   }
   ```

### Phase 2: Audio Integration (Week 3-4)
1. **Setup OpenAI Whisper API**
   ```typescript
   import OpenAI from "openai";
   
   class WhisperAudioAnalyzer implements AudioAnalyzer {
     private client: OpenAI;
     
     constructor(apiKey: string) {
       this.client = new OpenAI({ apiKey });
     }
     
     async transcribeAudio(audio: AudioContext) {
       const transcription = await this.client.audio.transcriptions.create({
         file: fs.createReadStream(audio.metadata.filePath),
         model: "whisper-1",
         language: audio.language,
       });
       
       return {
         text: transcription.text,
         confidence: 0.95, // Whisper doesn't provide confidence
         segments: [], // Use word-level timestamps if available
         language: audio.language || "en",
       };
     }
   }
   ```

2. **Integrate with Claude for Analysis**
   ```typescript
   async analyzeCodeExplanation(audio: AudioContext) {
     const transcript = await this.transcribeAudio(audio);
     
     // Use Claude to extract issues and action items
     const analysis = await claudeClient.messages.create({
       model: "claude-3-5-sonnet-20241022",
       messages: [{
         role: "user",
         content: `Analyze this code review transcript and extract:
         1. Detected issues (with severity and type)
         2. Action items
         3. Code references
         
         Transcript: ${transcript.text}`,
       }],
     });
     
     // Parse structured response
   }
   ```

### Phase 3: Document Integration (Week 5-6)
1. **Setup PDF Parsing**
   ```bash
   npm install pdf-parse xlsx mammoth
   ```
   
   ```typescript
   import pdfParse from "pdf-parse";
   import xlsx from "xlsx";
   
   class DocumentAnalyzerImpl implements DocumentAnalyzer {
     async analyzePDF(document: DocumentContext) {
       const buffer = await this.loadDocument(document);
       const pdfData = await pdfParse(buffer);
       
       // Use Claude to extract structured requirements
       const response = await claudeClient.messages.create({
         model: "claude-3-5-sonnet-20241022",
         messages: [{
           role: "user",
           content: `Extract requirements from this PDF text:
           ${pdfData.text}
           
           Return structured JSON with requirement IDs, types, priorities, etc.`,
         }],
       });
       
       // Parse and structure the response
     }
   }
   ```

### Phase 4: Context Fusion Optimization (Week 7-8)
1. **Smart Context Prioritization**
   - Implement token-aware chunking
   - Priority-based modality inclusion
   - Relevance scoring for each modality

2. **Prompt Optimization**
   - A/B test different prompt structures
   - Measure accuracy by modality combination
   - Optimize for cost vs. quality

## Testing Strategy

### Unit Tests
All modules have comprehensive unit tests with mocks:
```bash
npm test tests/multimodal.test.ts
```

### Integration Tests (Post-Activation)
```typescript
describe("Multi-Modal Integration", () => {
  it("should analyze bug report with screenshot", async () => {
    const task: AgentTask = {
      // ... task config
      imageContext: [{
        metadata: { /* screenshot */ },
        purpose: "bug-detection",
      }],
    };
    
    const result = await executeAgentTask(task);
    expect(result.output).toContain("detected UI issue");
  });
});
```

### E2E Tests
1. Upload screenshot → Get accessibility report
2. Upload audio standup → Extract action items
3. Upload requirements PDF → Generate tasks
4. Combine all modalities → Get comprehensive analysis

## Security Considerations

### Input Validation
- File size limits (configured per modality)
- Format validation (PNG, JPG, MP3, PDF, etc.)
- Malware scanning for uploads
- Filename sanitization

### Data Privacy
- Temporary storage with automatic cleanup
- Encryption at rest (optional, configurable)
- PII detection and redaction
- Audit logging for all API calls

### Rate Limiting
```typescript
// Add to middleware/rate-limiter.ts
export async function rateLimitMultimodal(
  userId: string,
  modality: "vision" | "audio" | "document"
): Promise<boolean> {
  const limits = {
    vision: 100,    // 100 images/hour
    audio: 50,      // 50 audio files/hour
    document: 30,   // 30 documents/hour
  };
  
  const key = `multimodal:${modality}:${userId}`;
  const count = await redis.incr(key);
  
  if (count === 1) {
    await redis.expire(key, 3600); // 1 hour
  }
  
  return count <= limits[modality];
}
```

## Cost Estimation

### Per-Request Costs (Approximate)
- **Vision Analysis**: $0.01 - $0.05 per image
- **Audio Transcription**: $0.006 per minute (Whisper)
- **Document Analysis**: $0.02 - $0.10 per document

### Monthly Costs (Estimated)
- **Free Tier**: 10 images + 5 audio + 5 docs = ~$1-2/month
- **Pro Tier**: 100 images + 50 audio + 30 docs = ~$10-20/month
- **Enterprise**: Custom pricing based on volume

## Metrics & Monitoring

### Key Metrics
1. **Usage Metrics**
   - API calls per modality
   - Average processing time
   - Success/failure rates
   - Token consumption

2. **Quality Metrics**
   - Accuracy of extracted requirements
   - UI issue detection precision/recall
   - Action item extraction completeness

3. **Performance Metrics**
   - Latency by modality
   - Context fusion time
   - End-to-end task completion time

### Monitoring Dashboard
```typescript
// Add to services/analytics.ts
export async function trackMultiModalUsage(
  modality: "vision" | "audio" | "document",
  duration: number,
  success: boolean,
  metadata?: Record<string, any>
) {
  await db.insert(multiModalMetrics).values({
    modality,
    duration,
    success,
    metadata,
    timestamp: new Date(),
  });
}
```

## Future Enhancements

### Q2 2026
- [ ] Video analysis (UI walkthroughs, demos)
- [ ] Real-time screen sharing analysis
- [ ] Multi-language audio support (10+ languages)
- [ ] Collaborative diagram editing with AI

### Q3 2026
- [ ] 3D model/CAD file analysis
- [ ] AR/VR context support
- [ ] Live coding session analysis
- [ ] Automated design system compliance

### Q4 2026
- [ ] Custom model fine-tuning
- [ ] On-premise deployment options
- [ ] Advanced context caching
- [ ] Multi-modal RAG integration

## Support & Documentation

### Getting Help
- **Slack**: #devbot-multimodal
- **Docs**: https://docs.devbot.ai/multimodal
- **Issues**: GitHub Issues with `multimodal` label

### Contributing
See `CONTRIBUTING_MULTIMODAL.md` for:
- Adding new modality providers
- Extending analysis capabilities
- Writing tests for new features
- Performance optimization guidelines

## References
- [Claude Vision API](https://docs.anthropic.com/claude/docs/vision)
- [OpenAI Whisper API](https://platform.openai.com/docs/guides/speech-to-text)
- [Azure Document Intelligence](https://learn.microsoft.com/azure/ai-services/document-intelligence/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
