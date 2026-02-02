import express, { Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { db } from './db';
import { webhooks } from './db/schema';
import { webhookQueue } from './queue';
import logger from './utils/logger';

const app: express.Application = express();

// Middleware
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

// Request logging
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  next();
});

/**
 * Health check
 */
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'hookbot',
    version: '1.0.0',
    uptime: process.uptime(),
  });
});

/**
 * Webhook receiver
 * POST /webhooks/:service/:event
 */
app.post('/webhooks/:service/:event', async (req: Request, res: Response) => {
  try {
    const { service, event } = req.params;
    const payload = req.body;
    const headers = req.headers as Record<string, string>;

    logger.info(`Webhook received: ${service}/${event}`);

    // Store webhook
    const [webhook] = await db.insert(webhooks).values({
      service,
      event,
      payload,
      headers,
      verified: false, // Will be verified by adapter
    }).returning();

    // Queue for processing
    await webhookQueue.add('process-webhook', {
      webhookId: webhook.id,
      service,
      event,
      payload,
      headers,
    });

    res.status(202).json({
      status: 'accepted',
      webhookId: webhook.id,
    });
  } catch (error) {
    logger.error('Error receiving webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Manual workflow trigger
 * POST /workflows/:workflowId/trigger
 */
app.post('/workflows/:workflowId/trigger', async (req: Request, res: Response) => {
  try {
    const { workflowId } = req.params;
    const data = req.body;

    logger.info(`Manual workflow trigger: ${workflowId}`);

    // Queue workflow execution
    await webhookQueue.add('execute-workflow', {
      workflowId,
      trigger: {
        service: 'manual',
        event: 'trigger',
        payload: data,
      },
    });

    res.status(202).json({
      status: 'queued',
      workflowId,
    });
  } catch (error) {
    logger.error('Error triggering workflow:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * List workflows
 * GET /workflows
 */
app.get('/workflows', async (_req: Request, res: Response) => {
  try {
    const { workflows } = await import('./db/schema');
    const allWorkflows = await db.select().from(workflows);
    res.json(allWorkflows);
  } catch (error) {
    logger.error('Error listing workflows:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get workflow
 * GET /workflows/:workflowId
 */
app.get('/workflows/:workflowId', async (req: Request, res: Response) => {
  try {
    const { workflows } = await import('./db/schema');
    const { eq } = await import('drizzle-orm');
    const workflow = await db.select().from(workflows).where(eq(workflows.id, req.params.workflowId));

    if (!workflow.length) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    return res.json(workflow[0]);
  } catch (error) {
    logger.error('Error getting workflow:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Create workflow
 * POST /workflows
 */
app.post('/workflows', async (req: Request, res: Response) => {
  try {
    const { workflows } = await import('./db/schema');
    const workflowData = req.body;

    const [workflow] = await db.insert(workflows).values({
      name: workflowData.name,
      description: workflowData.description,
      enabled: workflowData.enabled ?? true,
      trigger: workflowData.trigger,
      steps: workflowData.steps,
      config: workflowData.config,
    }).returning();

    res.status(201).json(workflow);
  } catch (error) {
    logger.error('Error creating workflow:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get workflow executions
 * GET /workflows/:workflowId/executions
 */
app.get('/workflows/:workflowId/executions', async (req: Request, res: Response) => {
  try {
    const { executions } = await import('./db/schema');
    const { eq, desc } = await import('drizzle-orm');

    const workflowExecutions = await db
      .select()
      .from(executions)
      .where(eq(executions.workflowId, req.params.workflowId))
      .orderBy(desc(executions.startedAt))
      .limit(100);

    res.json(workflowExecutions);
  } catch (error) {
    logger.error('Error getting executions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: any) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  logger.info(`HookBot server running on ${HOST}:${PORT}`);
});

export default app;
