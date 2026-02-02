# @tolani-bots/make-sdk

Make.com (Core/Pro) Integration SDK for Tolani Bots

## Installation

```bash
pnpm add @tolani-bots/make-sdk
```

## Quick Start

```typescript
import { MakeClient, MakeWebhook, MakeScenario } from '@tolani-bots/make-sdk';

// Initialize client
const client = new MakeClient({
  apiToken: process.env.MAKE_API_TOKEN,
  teamId: process.env.MAKE_TEAM_ID,
});

// Send webhook to Make scenario
const webhook = new MakeWebhook({
  url: 'https://hook.make.com/your-webhook-url',
  secret: process.env.MAKE_WEBHOOK_SECRET,
});

await webhook.sendBottleneck({
  id: 'bottleneck-123',
  title: 'AWS credentials missing - deploy blocked',
  priority: 'CRITICAL',
  assignedTo: 'CTO',
});

// Manage scenarios
const scenario = new MakeScenario(client);
const metrics = await scenario.getMetrics('scenario-id');
console.log(`Success rate: ${metrics.successRate}%`);
```

## Features

### 1. Webhook Management

Send events from Junior/DevBot to Make.com scenarios:

```typescript
const webhook = new MakeWebhook({
  url: 'https://hook.make.com/abc123',
  secret: 'your-webhook-secret', // Optional but recommended
});

// Send bottleneck detection
await webhook.sendBottleneck({
  id: 'btn-001',
  title: 'Database migration blocked',
  description: 'Waiting for DBA approval',
  priority: 'HIGH',
  assignedTo: 'Database Team',
  metadata: {
    estimatedTime: '2 hours',
    service: 'PostgreSQL',
  },
});

// Send approval request
await webhook.sendApprovalRequest({
  id: 'apr-001',
  title: 'Budget approval: $50K marketing spend',
  priority: 'MEDIUM',
  assignedTo: 'CFO',
  metadata: {
    amount: 50000,
    department: 'Marketing',
    quarter: 'Q1 2026',
  },
});

// Send crisis mode activation
await webhook.sendCrisisMode({
  id: 'crisis-001',
  title: 'Production API down - 500 errors',
  metadata: {
    service: 'API Gateway',
    errorRate: '95%',
  },
});
```

### 2. Scenario Management

Manage Make.com scenarios programmatically:

```typescript
const client = new MakeClient({
  apiToken: process.env.MAKE_API_TOKEN,
  teamId: process.env.MAKE_TEAM_ID,
});

// List all scenarios
const scenarios = await client.getScenarios();

// Enable/disable scenario
await client.enableScenario('scenario-id');
await client.disableScenario('scenario-id');

// Run scenario manually
const execution = await client.runScenario('scenario-id', {
  customData: 'value',
});

// Get execution history
const executions = await client.getExecutions('scenario-id', 10);

// Get performance metrics
const scenario = new MakeScenario(client);
const metrics = await scenario.getMetrics('scenario-id');
console.log({
  successRate: metrics.successRate,
  avgDuration: metrics.averageDuration,
  totalOps: metrics.totalOperations,
});

// Health check
const health = await scenario.healthCheck('scenario-id');
if (!health.healthy) {
  console.error('Issues:', health.issues);
}
```

### 3. Data Store

Use Make.com Data Stores for persistent state:

```typescript
import { MakeDataStore } from '@tolani-bots/make-sdk';

const store = new MakeDataStore(client, 'datastore-id');

// Set value
await store.set('approvals_pending', 42);

// Get value
const count = await store.get('approvals_pending');

// Increment counter
await store.increment('bottlenecks_resolved');

// Append to array
await store.append('recent_alerts', {
  timestamp: new Date().toISOString(),
  severity: 'HIGH',
});

// List all records
const records = await store.list({ limit: 100 });
```

### 4. Pre-Built Templates

Deploy common integrations instantly:

```typescript
import { TEMPLATES, getTemplate } from '@tolani-bots/make-sdk/templates';

// Get template
const template = getTemplate('bottleneck-to-jira');

// Create scenario from template
const scenario = await client.createScenario(
  template.name,
  template.blueprint
);

console.log('Setup instructions:');
template.setupInstructions.forEach((step, i) => {
  console.log(`${i + 1}. ${step}`);
});
```

**Available Templates:**

| Template | Services | Category |
|----------|----------|----------|
| `bottleneck-to-jira` | Junior → Jira | Project Management |
| `approval-from-salesforce` | Salesforce → Junior | CRM |
| `stripe-payment-approval` | Stripe → Junior | Finance |
| `github-deploy-notification` | GitHub → OpsBot | DevOps |
| `datadog-alert-crisis` | Datadog → Junior | Analytics |

## Configuration

### Environment Variables

```bash
# Make.com API credentials
MAKE_API_TOKEN=your-api-token
MAKE_TEAM_ID=your-team-id

# Webhook URLs (one per scenario)
MAKE_WEBHOOK_BOTTLENECK_URL=https://hook.make.com/abc123
MAKE_WEBHOOK_APPROVAL_URL=https://hook.make.com/def456
MAKE_WEBHOOK_CRISIS_URL=https://hook.make.com/ghi789

# Optional: Webhook security
MAKE_WEBHOOK_SECRET=your-secret-key
```

### Getting Your API Token

1. Log in to Make.com
2. Go to **Profile** → **API**
3. Click **Create Token**
4. Copy token to `MAKE_API_TOKEN`
5. Find **Team ID** in URL or Account settings

## Usage with Junior Bot

Integrate with Junior's bottleneck detection:

```typescript
// src/integrations/make.ts
import { MakeWebhook } from '@tolani-bots/make-sdk';

const bottleneckWebhook = new MakeWebhook({
  url: process.env.MAKE_WEBHOOK_BOTTLENECK_URL!,
  secret: process.env.MAKE_WEBHOOK_SECRET,
});

export async function notifyMakeBottleneck(bottleneck: Bottleneck) {
  const result = await bottleneckWebhook.sendBottleneck({
    id: bottleneck.id,
    title: bottleneck.title,
    description: bottleneck.description,
    priority: bottleneck.priority,
    assignedTo: bottleneck.assignedTo,
    metadata: {
      detectedAt: bottleneck.detectedAt,
      slaDeadline: bottleneck.slaDeadline,
    },
  });

  if (!result.success) {
    console.error('Failed to send to Make.com:', result.error);
  }
}

// In Junior's bottleneck detector
import { notifyMakeBottleneck } from './integrations/make';

async function detectBottlenecks() {
  const bottlenecks = await findBottlenecks();
  
  for (const bottleneck of bottlenecks) {
    // Store in Junior database
    await db.bottlenecks.create(bottleneck);
    
    // Send to Make.com for routing
    await notifyMakeBottleneck(bottleneck);
  }
}
```

## Usage with Make.com Scenarios

### Scenario 1: Bottleneck → Jira Ticket

**Flow:**
```
Junior detects bottleneck
  ↓ (webhook)
Make.com receives
  ↓ (filter by priority)
Create Jira ticket
  ↓ (get ticket URL)
Send Slack notification
```

**Setup:**
1. Create new scenario in Make.com
2. Add **Webhook** module → Copy URL
3. Add **Jira - Create Issue** module
4. Add **Slack - Send Message** module
5. Enable scenario
6. Add webhook URL to Junior config

### Scenario 2: Jira Status → Junior Approval

**Flow:**
```
Jira ticket status changes to "Done"
  ↓ (webhook)
Make.com receives
  ↓ (extract Junior approval ID)
Call Junior API: /api/approvals/complete
  ↓
Junior unblocks task
```

**Setup:**
1. Create Jira webhook → Make.com
2. Filter for status = "Done"
3. HTTP module → POST to Junior
4. Enable scenario

## Advanced Usage

### Custom Webhook Validation

```typescript
import express from 'express';
import { MakeWebhook } from '@tolani-bots/make-sdk';

const app = express();
const webhook = new MakeWebhook({
  url: '', // Not needed for receiving
  secret: process.env.MAKE_WEBHOOK_SECRET,
});

app.post('/webhooks/make', express.json(), (req, res) => {
  const payload = webhook.parseIncomingWebhook(req.body, req.headers);
  
  if (!payload) {
    return res.status(401).json({ error: 'Invalid webhook' });
  }

  // Process webhook
  processApproval(payload);
  
  res.status(200).json({ status: 'received' });
});
```

### Retry Logic

```typescript
const webhook = new MakeWebhook({
  url: 'https://hook.make.com/abc123',
  timeout: 10000, // 10 seconds
});

async function sendWithRetry(data: any, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const result = await webhook.sendBottleneck(data);
    
    if (result.success) {
      return result;
    }
    
    if (i < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  
  throw new Error('Failed after max retries');
}
```

### Batch Operations

```typescript
const scenarios = await client.getScenarios();

// Enable all disabled scenarios
const disabled = scenarios.filter(s => !s.isRunning);
await Promise.all(
  disabled.map(s => client.enableScenario(s.id))
);

// Get metrics for all scenarios
const allMetrics = await Promise.all(
  scenarios.map(async s => ({
    name: s.name,
    metrics: await new MakeScenario(client).getMetrics(s.id),
  }))
);
```

## Error Handling

```typescript
import { MakeError } from '@tolani-bots/make-sdk';

try {
  await webhook.sendBottleneck(data);
} catch (error) {
  const makeError = error as MakeError;
  
  if (makeError.statusCode === 401) {
    console.error('Invalid API token');
  } else if (makeError.statusCode === 429) {
    console.error('Rate limited - try again later');
  } else if (makeError.statusCode >= 500) {
    console.error('Make.com server error');
  } else {
    console.error('Unknown error:', makeError.message);
  }
}
```

## Testing

```typescript
import { describe, it, expect } from 'vitest';
import { MakeWebhook } from '@tolani-bots/make-sdk';

describe('MakeWebhook', () => {
  it('should generate valid signature', () => {
    const webhook = new MakeWebhook({
      url: 'https://test.com',
      secret: 'test-secret',
    });

    const payload = { event: 'test', data: {} };
    const signature = (webhook as any).generateSignature(payload);
    
    expect(signature).toBeDefined();
    expect(signature.length).toBe(64); // SHA256 hex
  });
});
```

## Pricing Considerations

**Make.com Operations:**
- Each webhook received = 1 operation
- Each API call (Jira, Slack, etc.) = 1 operation
- Typical scenario = 2-5 operations per execution

**Plans:**
- **Free:** 1,000 operations/month
- **Core ($9/mo):** 10,000 operations/month
- **Pro ($16/mo):** 10,000 operations/month + advanced features
- **Teams ($29/mo):** 40,000 operations/month
- **Enterprise:** Custom

**Recommendation:** Start with **Pro** ($16/mo) for advanced modules and custom apps.

## Support

- Documentation: [Make.com Docs](https://www.make.com/en/api-documentation)
- Community: [Make.com Forum](https://community.make.com/)
- Issues: [GitHub Issues](https://github.com/Tolani-Corp/DevBot/issues)

## License

MIT © Tolani Corp
