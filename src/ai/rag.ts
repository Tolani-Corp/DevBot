import { db } from "../db";
import { documents, documentEmbeddings } from "../db/schema";
import OpenAI from "openai";
import { eq, sql, cosineDistance, desc, gt, and } from "drizzle-orm";
import { nanoid } from "nanoid";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const EMBEDDING_MODEL = "text-embedding-3-small";

export class RAGEngine {
    /**
     * Generates embedding for a given text
     */
    async generateEmbedding(text: string): Promise<number[]> {
        const response = await openai.embeddings.create({
            model: EMBEDDING_MODEL,
            input: text.replace(/\n/g, " "),
        });
        return response.data[0].embedding;
    }

    /**
     * Process a file: chunk it, embed chunks, and store in DB
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

        // 3. Chunk content
        const chunks = this.chunkText(content, 1000); // ~1000 chars per chunk

        // 4. Generate embeddings and store
        for (const [index, chunk] of chunks.entries()) {
            const embedding = await this.generateEmbedding(chunk);
            await db.insert(documentEmbeddings).values({
                documentId: docId,
                chunkIndex: index,
                content: chunk,
                embedding,
            });
        }

        return docId;
    }

    /**
     * Search for relevant code chunks
     */
    async search(query: string, repository: string, limit = 5) {
        const queryEmbedding = await this.generateEmbedding(query);

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

    private chunkText(text: string, maxLength: number): string[] {
        const chunks: string[] = [];
        let currentChunk = "";

        const lines = text.split("\n");
        for (const line of lines) {
            if ((currentChunk + line).length > maxLength) {
                chunks.push(currentChunk);
                currentChunk = line + "\n";
            } else {
                currentChunk += line + "\n";
            }
        }
        if (currentChunk.trim().length > 0) {
            chunks.push(currentChunk);
        }
        return chunks;
    }
}

export const ragEngine = new RAGEngine();
