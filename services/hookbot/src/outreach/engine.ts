import { db } from '../db';
import { campaigns, contacts, sequences, variants, analytics, type Contact, type Sequence, type Variant } from '../db/schema';
import logger from '../utils/logger';
import { eq, and, lte } from 'drizzle-orm';

/**
 * Outreach Engine
 * Manages the execution of outreach campaigns and sequences.
 */
export class OutreachEngine {

    /**
     * Process all active campaigns and dispatch steps for due contacts.
     * Scalable architecture: Fetch batch, process, repeat.
     */
    async processCampaigns() {
        logger.info('Starting outreach processing cycle...');

        // 1. Get active campaigns
        const activeCampaigns = await db.query.campaigns.findMany({
            where: eq(campaigns.status, 'active')
        });

        for (const campaign of activeCampaigns) {
            await this.processContactsForCampaign(campaign.id);
        }
    }

    /**
     * Process contacts for a specific campaign.
     */
    private async processContactsForCampaign(campaignId: string) {
        // 2. Find contacts ready for the next action
        const dueContacts = await db.query.contacts.findMany({
            where: and(
                eq(contacts.campaignId, campaignId),
                eq(contacts.status, 'active'),
                lte(contacts.nextActionAt, new Date())
            ),
            limit: 50 // Batch size
        });

        if (dueContacts.length === 0) return;

        logger.info(`Processing ${dueContacts.length} contacts for campaign ${campaignId}`);

        // 3. Dispatch step for each contact
        for (const contact of dueContacts) {
            await this.dispatchStep(contact);
        }
    }

    /**
     * Execute the current step for a contact and advance them.
     */
    private async dispatchStep(contact: Contact) {
        // Get the sequence step corresponding to contact.currentStep
        const currentStep = await db.query.sequences.findFirst({
            where: and(
                eq(sequences.campaignId, contact.campaignId),
                eq(sequences.order, contact.currentStep!)
            )
        });

        // If no more steps, mark completed
        if (!currentStep) {
            await db.update(contacts).set({ status: 'completed' }).where(eq(contacts.id, contact.id));
            return;
        }

        try {
            if (currentStep.type === 'email') {
                await this.handleEmailStep(contact, currentStep);
            } else if (currentStep.type === 'delay') {
                await this.handleDelayStep(contact, currentStep);
            }

            // Advance to next step (handled inside step handlers or here?)
            // Usually, 'email' advances immediately. 'delay' sets nextActionAt.

            if (currentStep.type !== 'delay') {
                await this.advanceContact(contact);
            }

        } catch (error) {
            logger.error(`Failed to process step for contact ${contact.id}`, error);
        }
    }

    private async handleEmailStep(contact: Contact, step: Sequence) {
        // VARIANT SELECTION (A/Z Testing Logic)
        const stepVariants = await db.query.variants.findMany({
            where: and(
                eq(variants.sequenceId, step.id),
                eq(variants.status, 'active')
            )
        });

        if (stepVariants.length === 0) {
            throw new Error(`No active variants for step ${step.id}`);
        }

        // Weighted Random Selection
        const selectedVariant = this.selectVariant(stepVariants);

        logger.info(`Sending email to ${contact.email} using variant "${selectedVariant.name}"`);

        // TODO: Actual Email Sending Logic (e.g. SMTP/Resend/Mailgun)
        // await emailService.send(...)

        // Record Analytics
        await this.trackEvent(selectedVariant.id, 'sends');
    }

    private async handleDelayStep(contact: Contact, step: Sequence) {
        const config = step.config as { days?: number, hours?: number };
        const delayMs = ((config.days || 0) * 24 * 60 * 60 * 1000) + ((config.hours || 0) * 60 * 60 * 1000);

        const nextTime = new Date(Date.now() + delayMs);

        // Update contact's next action time and increment step index effectively skipping "processing" this step again
        // Actually, for delay, we just want to push the *next* step's execution time.
        // So we increment step AND set time.
        await db.update(contacts)
            .set({
                currentStep: (contact.currentStep || 0) + 1,
                nextActionAt: nextTime
            })
            .where(eq(contacts.id, contact.id));
    }

    private async advanceContact(contact: Contact) {
        // Move to next step immediately
        await db.update(contacts)
            .set({ currentStep: (contact.currentStep || 0) + 1 })
            .where(eq(contacts.id, contact.id));
    }

    /**
     * Helper: Select a variant based on weights
     */
    private selectVariant(stepVariants: Variant[]): Variant {
        const totalWeight = stepVariants.reduce((sum, v) => sum + (v.weight || 0), 0);
        let random = Math.random() * totalWeight;

        for (const variant of stepVariants) {
            random -= (variant.weight || 0);
            if (random <= 0) return variant;
        }
        return stepVariants[0]; // Fallback
    }

    private async trackEvent(variantId: string, type: 'sends' | 'opens' | 'replies') {
        // Upsert analytics
        // simple increment for now
        const existing = await db.query.analytics.findFirst({ where: eq(analytics.variantId, variantId) });

        if (existing) {
            await db.update(analytics)
                .set({ [type]: (existing[type] || 0) + 1, lastUpdated: new Date() })
                .where(eq(analytics.id, existing.id));
        } else {
            await db.insert(analytics).values({
                variantId,
                [type]: 1
            });
        }
    }
}
