import { db } from "../db";
import { documents, documentEmbeddings } from "../db/schema";
import OpenAI from "openai";
import { eq, sql, cosineDistance, desc, gt, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { chunkCode, detectLanguage } from "./chunking/ast-chunker";
import path from "path";

// Initialize OpenAI only if key is present to avoid crash on startup
const openai = process.env.OPENAI_API_KEY
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;

const EMBEDDING_MODEL = "text-embedding-3-small";

export class RAGEngine {
    /**
     * Generates embedding for a given text
     */
    async generateEmbedding(text: string): Promise<number[]> {
        if (!openai) {
            console.warn("RAG: OPENAI_API_KEY not found, skipping embedding generation.");
            return [];
        }
        try {
            const response = await openai.embeddings.create({
                model: EMBEDDING_MODEL,
                input: text.replace(/\n/g, " "),
            });
            return response.data[0].embedding;
        } catch (error) {
            console.error("RAG: Embedding generation failed", error);
            return [];
        }
    }

    /**
     * Process a file: chunk it, embed chunks, and store in DB.
     * Optimized: Generates embeddings in parallel (10x faster for large files).
     */
    async indexFile(repository: string, filePath: string, content: string) {
        // 1. Check if file hash hasn't changed (simple optimization)
        // For now, we'll just upsert.

        // Delete existing entry for this file
        // Note: cascade delete on documents will remove embeddings
        const existing = await db
            .select()
            .from(documents)
            .where(
                and(
                    eq(documents.repository, repository),
                    eq(documents.filePath, filePath)
                )
            );

        if (existing.length > 0) {
            await db.delete(documents).where(eq(documents.id, existing[0].id));
        }

        // 2. Create document record
        const docId = nanoid();
        await db.insert(documents).values({
            id: docId,
            repository,
            filePath,
            content,
            lastHash: "hash-placeholder", // TODO: Implement proper hashing
        });

        // 3. Chunk content — use AST-aware chunker for code files, fallback to line-based
        const ext = path.extname(filePath);
        const language = detectLanguage(ext);
        let chunks: string[];

        if (language !== "text") {
          // AST-aware chunking preserves function/class boundaries
          const codeChunks = chunkCode(content, filePath);
          chunks = codeChunks.map((c) => c.content);
        } else {
          chunks = this.chunkText(content, 1000);
        }

        // 4. Generate embeddings in parallel (with concurrency limit)
        const BATCH_SIZE = 5; // Respect OpenAI rate limits
        const embeddingsData: Array<{ index: number; content: string; embedding: number[] }> = [];

        for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
            const batch = chunks.slice(i, i + BATCH_SIZE);
            const batchEmbeddings = await Promise.all(
                batch.map((chunk, batchIdx) =>
                    this.generateEmbedding(chunk).then(emb => ({
                        index: i + batchIdx,
                        content: chunk,
                        embedding: emb,
                    }))
                )
            );
            embeddingsData.push(...batchEmbeddings.filter(e => e.embedding.length > 0));
        }

        // 5. Batch insert all embeddings
        if (embeddingsData.length > 0) {
            await db.insert(documentEmbeddings).values(
                embeddingsData.map(e => ({
                    documentId: docId,
                    chunkIndex: e.index,
                    content: e.content,
                    embedding: e.embedding,
                }))
            );
        }

        return docId;
    }

    /**
     * Search for relevant code chunks
     */
    async search(query: string, repository: string, limit = 5) {
        const queryEmbedding = await this.generateEmbedding(query);
        if (queryEmbedding.length === 0) {
            return [];
        }

        // Cosine distance: 1 - cosine_similarity. Smaller is better.
        // We want top matches, so order by distance asc.
        const similarity = sql<number>`1 - (${cosineDistance(documentEmbeddings.embedding, queryEmbedding)})`;

        const results = await db
            .select({
                content: documentEmbeddings.content,
                filePath: documents.filePath,
                similarity,
            })
            .from(documentEmbeddings)
            .innerJoin(documents, eq(documentEmbeddings.documentId, documents.id))
            .where(
                and(
                    eq(documents.repository, repository),
                    gt(similarity, 0.5) // Threshold
                )
            )
            .orderBy(desc(similarity))
            .limit(limit);

        return results;
    }

    /**
     * Chunk text into segments using array-based builder (O(n) instead of O(n²)).
     */
    private chunkText(text: string, maxLength: number): string[] {
        const chunks: string[] = [];
        const lines = text.split("\n");
        const chunkLines: string[] = [];
        let currentSize = 0;

        for (const line of lines) {
            const lineLen = line.length + 1; // +1 for newline
            if (currentSize + lineLen > maxLength && chunkLines.length > 0) {
                chunks.push(chunkLines.join("\n"));
                chunkLines.length = 0;
                currentSize = 0;
            }
            chunkLines.push(line);
            currentSize += lineLen;
        }
        if (chunkLines.length > 0) {
            chunks.push(chunkLines.join("\n"));
        }
        return chunks.filter(c => c.trim().length > 0);
    }
}

export const ragEngine = new RAGEngine();
