import { db } from '../db';
import { analytics } from '../db/schema';
import logger from '../utils/logger';
import { eq, sql } from 'drizzle-orm';

/**
 * Analytics Service
 * Handles tracking of outreach events.
 */
export class AnalyticsService {

    /**
     * Track an event for a specific variant.
     */
    async track(variantId: string, event: 'sends' | 'opens' | 'clicks' | 'replies' | 'bounces') {
        try {
            // Upsert logic: simple collision handling
            // Attempt to update first
            const result = await db.update(analytics)
                .set({
                    [event]: sql`${analytics[event]} + 1`,
                    lastUpdated: new Date()
                })
                .where(eq(analytics.variantId, variantId))
                .returning();

            // If no row existed, insert new one
            if (result.length === 0) {
                await db.insert(analytics).values({
                    variantId,
                    [event]: 1
                }).onConflictDoUpdate({
                    target: analytics.variantId,
                    set: {
                        [event]: sql`${analytics[event]} + 1`,
                        lastUpdated: new Date()
                    }
                });
            }
        } catch (error) {
            logger.error(`Failed to track ${event} for variant ${variantId}`, error);
        }
    }

    /**
     * Get stats for a variant
     */
    async getStats(variantId: string) {
        return db.query.analytics.findFirst({
            where: eq(analytics.variantId, variantId)
        });
    }
}

export const analyticsService = new AnalyticsService();
