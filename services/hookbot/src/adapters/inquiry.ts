import { IAdapter, ExecutionContext } from '../types';

/**
 * Inquiry Adapter
 * Handles generic "Lead Extraction" and "Inquiry Processing" tasks.
 * Ported from "Customer Inquiry Bot".
 */
export class InquiryAdapter implements IAdapter {
    name = 'Inquiry Processor';
    service = 'inquiry';

    private openaiApiKey: string | undefined;

    async initialize(config: Record<string, any>): Promise<void> {
        this.openaiApiKey = config.openaiApiKey || process.env.OPENAI_API_KEY;
    }

    async execute(
        action: string,
        params: Record<string, any>,
        _context: ExecutionContext
    ): Promise<any> {
        switch (action) {
            case 'extractLeadFromForm':
                return this.extractLeadFromForm(params);
            case 'classifyContent':
                return this.classifyContent(params);
            case 'processInquiry':
                return this.processInquiry(params);
            default:
                throw new Error(`Unknown action: ${action}`);
        }
    }

    /**
     * Extract lead details from a form submission or JSON payload
     * Logic ported from 'extractLeadFromForm.ts'
     */
    private async extractLeadFromForm(params: any): Promise<any> {
        const { payload, source } = params;

        // In a real scenario, this would parsing complex HTML or PDF text
        // For now, we standardize the input
        let extracted = {
            name: payload.name || payload.fullName || "Unknown",
            email: payload.email || payload.contactEmail,
            phone: payload.phone || payload.contactPhone,
            intent: payload.intent || payload.subject || "general",
            source: source || "dropbox_form",
            raw: payload
        };

        console.log(`[InquiryAdapter] Extracted lead: ${extracted.email}`);
        return extracted;
    }

    /**
     * Classify content using LLM (OpenAI)
     * Logic ported from 'classifyContent.ts'
     */
    private async classifyContent(params: any): Promise<any> {
        const { content, categories } = params;

        if (!this.openaiApiKey) {
            console.warn("[InquiryAdapter] OpenAI API Key missing. Skipping classification.");
            return ["unclassified"];
        }

        try {
            const response = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.openaiApiKey}`
                },
                body: JSON.stringify({
                    model: "gpt-4-turbo-preview",
                    messages: [
                        {
                            role: "system",
                            content: `Classify the following content into one or more of these categories: ${(categories || []).join(", ")}. Return only comma-separated tags.`
                        },
                        { role: "user", content: content }
                    ]
                })
            });

            if (!response.ok) {
                throw new Error(`OpenAI API Error: ${response.statusText}`);
            }

            const data = await response.json();
            const tags = data.choices[0].message.content.split(",").map((t: string) => t.trim());
            return tags;
        } catch (error) {
            console.error("[InquiryAdapter] Classification failed:", error);
            return ["classification_failed"];
        }
    }

    /**
     * Composite action: Ingest, Extract, and Log
     */
    private async processInquiry(params: any): Promise<any> {
        // 1. Ingest (Mock DB save or forward to other service)
        const lead = await this.extractLeadFromForm(params);

        // 2. Classify (if content exists)
        if (params.payload.message || params.payload.description) {
            const content = params.payload.message || params.payload.description;
            const categories = ["sales", "support", "partnership", "spam"];
            lead.tags = await this.classifyContent({ content, categories });
        }

        return {
            status: "processed",
            lead,
            timestamp: new Date().toISOString()
        };
    }
}
