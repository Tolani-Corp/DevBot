# HookBot 🪝

**Self-hosted webhook orchestration engine for Tolani Bots**

HookBot is an open-source alternative to Make.com/Zapier, built specifically for enterprise use cases requiring self-hosting, advanced security, and complete control.

## Features

- ✅ **Self-Hosted** - Run on your own infrastructure
- ✅ **Unlimited Operations** - No per-operation pricing
- ✅ **YAML Workflows** - Define workflows as code
- ✅ **Adapter System** - Extensible integration framework
- ✅ **Queue-Based** - BullMQ for reliable async processing
- ✅ **Type-Safe** - Built with TypeScript
- ✅ **Production-Ready** - PostgreSQL + Redis + Docker

## Architecture

```
Incoming Webhooks (Jira, Salesforce, Stripe, etc.)
            ↓
    HookBot API Server
            ↓
    BullMQ Queue (Redis)
            ↓
    HookBot Workers (concurrent)
            ↓
    Workflow Engine
            ↓
   ┌────────┼────────┐
   ▼        ▼        ▼
Adapters  HTTP   Junior/DevBot
(Jira)   Calls    (Tolani Bots)
```

## Quick Start

### Option 1: Docker (Recommended)

```bash
# Clone repository
git clone https://github.com/Tolani-Corp/DevBot.git
cd DevBot/services/hookbot

# Copy environment file
cp .env.example .env

# Edit configuration
nano .env

# Start services
docker-compose up -d

# Check logs
docker-compose logs -f hookbot

# API available at http://localhost:3000
```

### Option 2: Manual Installation

**Prerequisites:**
- Node.js 22+
- PostgreSQL 16+
- Redis 7+
- pnpm

```bash
# Install dependencies
pnpm install

# Set up database
createdb hookbot

# Run migrations
pnpm migration:run

# Start server
pnpm dev

# In another terminal, start worker
pnpm worker
```

## Configuration

Create `.env` file (see `.env.example`):

```bash
# Database
DATABASE_URL=postgresql://hookbot:hookbot@localhost:5432/hookbot

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Security
WEBHOOK_SECRET=your-secret-key
API_KEY=your-api-key

# Jira
JIRA_URL=https://your-company.atlassian.net
JIRA_EMAIL=your-email@company.com
JIRA_API_TOKEN=your-jira-token

# Junior Bot
JUNIOR_WEBHOOK_URL=http://localhost:3001/webhooks/hookbot
JUNIOR_API_KEY=your-junior-api-key
```

## Creating Workflows

### YAML Definition

Create `workflows/bottleneck-to-jira.yaml`:

```yaml
name: "Bottleneck → Jira Ticket"
description: "Create Jira ticket when Junior detects bottleneck"
enabled: true

trigger:
  service: junior
  event: bottleneck_detected

steps:
  - id: check_severity
    type: condition
    params:
      condition: "trigger.priority === 'CRITICAL' || trigger.priority === 'HIGH'"
      onFalse: []

  - id: create_ticket
    type: adapter_action
    params:
      adapter: jira
      action: createIssue
      params:
        project: "ENG"
        summary: "{{trigger.title}}"
        description: "{{trigger.description}}"
        priority: "{{trigger.priority === 'CRITICAL' ? 'Blocker' : 'High'}}"
        assignee: "{{trigger.assignedTo}}"
    output: jiraIssue

  - id: notify_junior
    type: junior_action
    params:
      action: update
      taskId: "{{trigger.id}}"
      data:
        jiraTicket: "{{jiraIssue.key}}"
        jiraUrl: "{{jiraIssue.webUrl}}"
```

### Load Workflow

```bash
curl -X POST http://localhost:3000/workflows \
  -H "Content-Type: application/json" \
  -d @workflows/bottleneck-to-jira.yaml
```

### Programmatic Creation

```typescript
import axios from 'axios';

const workflow = {
  name: "Stripe Payment → Approval",
  trigger: {
    service: "stripe",
    event: "payment_intent.succeeded"
  },
  steps: [
    {
      id: "check_amount",
      type: "condition",
      params: {
        condition: "trigger.amount > 5000000", // $50K
        onTrue: [
          {
            id: "escalate_to_junior",
            type: "junior_action",
            params: {
              action: "escalate",
              taskId: "{{trigger.id}}",
              data: {
                amount: "{{trigger.amount}}",
                customer: "{{trigger.customer}}"
              }
            }
          }
        ]
      }
    }
  ]
};

await axios.post('http://localhost:3000/workflows', workflow);
```

## Receiving Webhooks

HookBot exposes webhook endpoints for each service:

```
POST /webhooks/:service/:event
```

**Example:** Jira webhook

```bash
# Configure in Jira: Webhook URL
https://your-hookbot.com/webhooks/jira/issue_updated

# Jira sends:
POST /webhooks/jira/issue_updated
{
  "webhookEvent": "jira:issue_updated",
  "issue": {
    "key": "ENG-123",
    "fields": {
      "status": { "name": "Done" }
    }
  }
}
```

HookBot automatically:
1. Receives webhook
2. Stores in database
3. Queues for processing
4. Finds matching workflows
5. Executes workflow steps
6. Logs execution results

## Step Types

### 1. HTTP Request

```yaml
- id: call_api
  type: http
  params:
    url: "https://api.example.com/endpoint"
    method: POST
    headers:
      Authorization: "Bearer {{env.API_KEY}}"
    body:
      data: "{{trigger.value}}"
  output: apiResponse
```

### 2. Transform Data

```yaml
- id: transform
  type: transform
  params:
    input: "trigger.amount"
    expression: "input / 100" # Convert cents to dollars
  output: amountInDollars
```

### 3. Condition

```yaml
- id: check_value
  type: condition
  params:
    condition: "trigger.priority === 'CRITICAL'"
    onTrue:
      - id: send_alert
        type: http
        params:
          url: "{{env.ALERT_URL}}"
    onFalse:
      - id: log_event
        type: http
        params:
          url: "{{env.LOG_URL}}"
```

### 4. Adapter Action

```yaml
- id: create_jira_ticket
  type: adapter_action
  params:
    adapter: jira
    action: createIssue
    params:
      project: "ENG"
      summary: "{{trigger.title}}"
      priority: "High"
  output: jiraTicket
```

### 5. Junior Action

```yaml
- id: notify_junior
  type: junior_action
  params:
    action: escalate
    taskId: "{{trigger.id}}"
    data:
      priority: "CRITICAL"
```

### 6. Loop

```yaml
- id: process_items
  type: loop
  params:
    items: "trigger.records"
    steps:
      - id: update_each
        type: http
        params:
          url: "https://api.example.com/records/{{item.id}}"
          method: PATCH
```

### 7. Delay

```yaml
- id: wait
  type: delay
  params:
    duration: 5000 # 5 seconds
```

## Available Adapters

### Jira

```typescript
// Create issue
{
  adapter: 'jira',
  action: 'createIssue',
  params: {
    project: 'ENG',
    summary: 'Bug report',
    description: 'Description here',
    issuetype: 'Bug',
    priority: 'High',
    assignee: 'john.doe'
  }
}

// Update issue
{
  adapter: 'jira',
  action: 'updateIssue',
  params: {
    issueKey: 'ENG-123',
    fields: {
      status: 'In Progress'
    }
  }
}

// Add comment
{
  adapter: 'jira',
  action: 'addComment',
  params: {
    issueKey: 'ENG-123',
    body: 'Comment text'
  }
}
```

### More Adapters (Coming Soon)

- **Salesforce** - CRM operations
- **Stripe** - Payment processing
- **GitHub** - Repository management
- **Slack** - Messaging
- **Custom** - Build your own

## Building Custom Adapters

Create `src/adapters/custom.ts`:

```typescript
import { IAdapter, ExecutionContext } from '../types';

export class CustomAdapter implements IAdapter {
  name = 'Custom Service';
  service = 'custom';

  async initialize(config: Record<string, any>): Promise<void> {
    // Initialize with config
  }

  async execute(
    action: string,
    params: Record<string, any>,
    context: ExecutionContext
  ): Promise<any> {
    switch (action) {
      case 'doSomething':
        return this.doSomething(params);
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  private async doSomething(params: any): Promise<any> {
    // Implement your logic
  }
}
```

Register in `src/adapters/registry.ts`:

```typescript
import { CustomAdapter } from './custom';

const registry = new AdapterRegistry();
registry.register(new CustomAdapter());
```

## API Reference

### List Workflows

```http
GET /workflows
```

Response:
```json
[
  {
    "id": "uuid",
    "name": "Bottleneck → Jira",
    "enabled": true,
    "trigger": { "service": "junior", "event": "bottleneck_detected" }
  }
]
```

### Get Workflow

```http
GET /workflows/:workflowId
```

### Create Workflow

```http
POST /workflows
Content-Type: application/json

{
  "name": "New Workflow",
  "trigger": { "service": "jira", "event": "issue_created" },
  "steps": [...]
}
```

### Trigger Workflow Manually

```http
POST /workflows/:workflowId/trigger
Content-Type: application/json

{
  "customData": "value"
}
```

### Get Executions

```http
GET /workflows/:workflowId/executions
```

Response:
```json
[
  {
    "id": "uuid",
    "workflowId": "uuid",
    "status": "success",
    "duration": 1234,
    "startedAt": "2026-02-01T12:00:00Z",
    "finishedAt": "2026-02-01T12:00:01Z"
  }
]
```

## Monitoring

### Health Check

```bash
curl http://localhost:3000/health
```

### Logs

```bash
# Docker
docker-compose logs -f hookbot

# Local
tail -f logs/combined.log
tail -f logs/error.log
```

### Metrics

View execution metrics:
```bash
curl http://localhost:3000/workflows/:workflowId/executions
```

## Production Deployment

### Environment Variables

```bash
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@db.example.com:5432/hookbot
REDIS_HOST=redis.example.com
WEBHOOK_SECRET=strong-random-secret
API_KEY=strong-random-api-key
```

### Scaling

**Horizontal Scaling:**
```yaml
# docker-compose.yml
hookbot-worker:
  deploy:
    replicas: 5 # Run 5 worker instances
```

**Worker Concurrency:**
```bash
WORKER_CONCURRENCY=20 # Process 20 jobs simultaneously per worker
```

### Security

1. **HTTPS Only** - Use reverse proxy (nginx, Caddy)
2. **Webhook Secrets** - Validate all incoming webhooks
3. **API Key** - Protect API endpoints
4. **Database** - Use strong passwords, SSL connections
5. **Redis** - Enable authentication

### Backup

```bash
# PostgreSQL backup
pg_dump hookbot > hookbot_backup.sql

# Restore
psql hookbot < hookbot_backup.sql
```

## Comparison vs Make.com

| Feature | HookBot | Make.com |
|---------|---------|----------|
| **Hosting** | Self-hosted | Cloud only |
| **Pricing** | Free (hosting costs) | $9-$99+/month |
| **Operations** | Unlimited | 1K-100K/month |
| **Data Privacy** | Your infrastructure | Third-party |
| **Customization** | Full code access | Limited |
| **Compliance** | HIPAA, SOC2 ready | Enterprise only |
| **Visual Builder** | YAML (code) | Drag-and-drop |
| **Learning Curve** | Higher | Lower |

**Use HookBot when:**
- Enterprise security requirements
- High-volume operations (100K+/month)
- Regulated industries (healthcare, finance)
- Want complete control
- Building white-label SaaS

**Use Make.com when:**
- Non-technical team
- Low-moderate volume (<10K/month)
- Quick setup priority
- Visual workflow preference

## Roadmap

- [x] Core workflow engine
- [x] Jira adapter
- [ ] Visual workflow builder (React UI)
- [ ] 20+ pre-built adapters
- [ ] Workflow templates marketplace
- [ ] AI-assisted workflow creation
- [ ] Real-time monitoring dashboard
- [ ] Multi-tenancy support
- [ ] Workflow versioning
- [ ] A/B testing for workflows

## Contributing

We welcome contributions! See [CONTRIBUTING.md](../../CONTRIBUTING.md)

## License

MIT © Tolani Corp

## Support

- **Documentation:** [docs.tolanibots.com/hookbot](https://docs.tolanibots.com/hookbot)
- **Issues:** [GitHub Issues](https://github.com/Tolani-Corp/DevBot/issues)
- **Discord:** [Join Community](https://discord.gg/tolanibots)

---

**HookBot** - The last integration platform you'll ever need. 🪝
