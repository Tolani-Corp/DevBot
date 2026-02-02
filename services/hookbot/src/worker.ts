import { Worker, Job } from 'bullmq';
import { db } from './db';
import { webhooks } from './db/schema';
import { WorkflowEngine } from './engine';
import logger from './utils/logger';
import { connection } from './queue';

export { webhookQueue } from './queue';

const engine = new WorkflowEngine(db);

/**
 * Webhook processor worker
 */
const worker = new Worker(
  'webhooks',
  async (job: Job<any>) => {
    const { webhookId, service, event, payload } = job.data;

    logger.info(`Processing webhook: ${service}/${event}`, { webhookId });

    try {
      // Find matching workflows
      const { workflows } = await import('./db/schema');
      const { eq, and } = await import('drizzle-orm');

      const matchingWorkflows = await db
        .select()
        .from(workflows)
        .where(
          and(
            eq(workflows.enabled, true),
          )
        );

      // Filter workflows by trigger
      const triggeredWorkflows = matchingWorkflows.filter(
        (w: any) =>
          w.trigger.service === service && w.trigger.event === event
      );

      if (triggeredWorkflows.length === 0) {
        logger.info(`No workflows triggered for ${service}/${event}`);
        return { processed: 0 };
      }

      // Execute workflows
      const results = await Promise.allSettled(
        triggeredWorkflows.map((workflow: any) =>
          engine.execute(workflow.id, {
            service,
            event,
            payload,
          })
        )
      );

      const successful = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

      logger.info(`Workflows executed: ${successful} successful, ${failed} failed`);

      // Update webhook as processed
      await db
        .update(webhooks)
        .set({ processedAt: new Date(), verified: true })
        .where(eq(webhooks.id, webhookId));

      return {
        processed: triggeredWorkflows.length,
        successful,
        failed,
      };
    } catch (error) {
      logger.error('Error processing webhook:', error);
      throw error;
    }
  },
  {
    connection,
    concurrency: Number(process.env.WORKER_CONCURRENCY) || 10,
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  }
);

worker.on('completed', (job: Job) => {
  logger.info(`Job completed: ${job.id}`, job.returnvalue);
});

worker.on('failed', (job: Job | undefined, err: Error) => {
  logger.error(`Job failed: ${job?.id}`, err);
});

logger.info('HookBot worker started');
