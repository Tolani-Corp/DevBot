import { db } from '../db';
import { variants, analytics, type Variant } from '../db/schema';
import logger from '../utils/logger';
import { eq } from 'drizzle-orm';

/**
 * Optimization Engine (A/Z Testing Bandit)
 * Automatically adjusts variant weights based on performance.
 */
export class OptimizationEngine {

    // Config constants
    private readonly MIN_SENDS_FOR_SIGNIFICANCE = 100;

    /**
     * Run the optimization cycle for all active email sequences.
     */
    async optimize() {
        logger.info('Starting A/Z optimization cycle...');

        // 1. Get all email steps with active variants
        // Ideally we filter by campaigns active, but detailed query is complex.
        // For prototype, we scan all active variants grouped by sequence.

        // Fetch all active variants with their analytics
        const allVariants = await db.query.variants.findMany({
            where: eq(variants.status, 'active'),
            with: {
                // @ts-ignore - Relation needs to be defined in schema relations, using manual join if needed
                // For now, we'll fetch analytics separately in loop
            }
        });

        // Group by sequence
        const variantsBySequence: Record<string, Variant[]> = {};
        for (const v of allVariants) {
            if (!variantsBySequence[v.sequenceId]) variantsBySequence[v.sequenceId] = [];
            variantsBySequence[v.sequenceId].push(v);
        }

        // 2. Analyze each sequence group
        for (const [sequenceId, variants] of Object.entries(variantsBySequence)) {
            if (variants.length < 2) continue; // Need at least 2 to compare
            await this.optimizeSequenceGroup(sequenceId, variants);
        }
    }

    private async optimizeSequenceGroup(sequenceId: string, groupVariants: Variant[]) {
        logger.info(`Optimizing sequence ${sequenceId} (${groupVariants.length} variants)`);

        const stats = await Promise.all(groupVariants.map(async (v) => {
            const data = await db.query.analytics.findFirst({
                where: eq(analytics.variantId, v.id)
            });
            return {
                variant: v,
                sends: data?.sends || 0,
                replies: data?.replies || 0,
                rate: (data?.replies || 0) / (data?.sends || 1)
            };
        }));

        // Check significance
        const significantStats = stats.filter(s => s.sends >= this.MIN_SENDS_FOR_SIGNIFICANCE);

        // If we don't have enough data on at least 2 variants, we can't make a decision
        if (significantStats.length < 2) return;

        // Find winner and loser
        // Sort by Reply Rate desc
        significantStats.sort((a, b) => b.rate - a.rate);

        const best = significantStats[0];
        const worst = significantStats[significantStats.length - 1];

        // Simple Rule: If worst is < 50% of best, pause it.
        // Implementation of "Epsilon-Greedy" or simple thresholding.
        if (worst.rate < (best.rate * 0.5)) {
            logger.info(`📉 Variant "${worst.variant.name}" is underperforming (Rate: ${(worst.rate * 100).toFixed(2)}% vs Best: ${(best.rate * 100).toFixed(2)}%). Pausing.`);

            await db.update(variants)
                .set({ status: 'paused', weight: 0 })
                .where(eq(variants.id, worst.variant.id));

            // Re-distribute weight to the winner? 
            // Or just leave it as is, dispatch logic handles weights sum.
        }
    }
}
