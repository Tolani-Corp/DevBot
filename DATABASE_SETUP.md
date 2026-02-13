# DevBot Database Setup Guide

## Prerequisites

- PostgreSQL 14+ installed
- Node.js 22+ installed
- pnpm installed

## Quick Setup

### 1. Install PostgreSQL

**Windows (using Chocolatey):**
```powershell
choco install postgresql
```

**Or download from:** https://www.postgresql.org/download/windows/

### 2. Create Database

```powershell
# Start PostgreSQL service (if not running)
Start-Service postgresql-x64-14

# Create database
psql -U postgres -c "CREATE DATABASE devbot;"

# Create user (optional)
psql -U postgres -c "CREATE USER devbot_user WITH PASSWORD 'your_secure_password';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE devbot TO devbot_user;"
```

### 3. Enable pgvector Extension

The workspaces feature requires PostgreSQL with pgvector for embeddings:

```sql
-- Connect to devbot database
psql -U postgres -d devbot

-- Enable vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify installation
\dx
```

### 4. Configure Environment

Update your `.env` file with database credentials:

```bash
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/devbot
# or with custom user:
DATABASE_URL=postgresql://devbot_user:your_secure_password@localhost:5432/devbot
```

### 5. Run Migrations

```powershell
cd C:\Users\terri\Projects\DevBot
pnpm install
pnpm run db:migrate
```

This will create all tables including the new `workspaces` table for bot personalization.

## Alternative: Docker Setup

If you prefer Docker:

```powershell
# Pull PostgreSQL with pgvector
docker pull ankane/pgvector

# Run PostgreSQL container
docker run -d `
  --name devbot-postgres `
  -e POSTGRES_DB=devbot `
  -e POSTGRES_USER=devbot_user `
  -e POSTGRES_PASSWORD=secure_password `
  -p 5432:5432 `
  ankane/pgvector

# Update .env
DATABASE_URL=postgresql://devbot_user:secure_password@localhost:5432/devbot

# Run migrations
pnpm run db:migrate
```

## Verify Installation

### Check Tables Created

```sql
-- Connect to database
psql -U postgres -d devbot

-- List all tables
\dt

-- Expected tables:
-- audit_logs
-- conversations  
-- document_embeddings
-- documents
-- tasks
-- workspaces ← New table for personalization

-- Check workspaces table structure
\d workspaces
```

### Test Database Connection

```powershell
# From DevBot directory
node -e "import('postgres').then(p => p.default(process.env.DATABASE_URL).query('SELECT NOW()')).then(r => console.log('DB Connected:', r))"
```

## Database Schema

### Workspaces Table (Personalization)

```sql
CREATE TABLE "workspaces" (
  "id" text PRIMARY KEY NOT NULL,
  "slack_team_id" text UNIQUE,
  "discord_guild_id" text UNIQUE,
  "platform_type" text NOT NULL,
  "bot_name" text DEFAULT 'DevBot' NOT NULL,
  "bot_mention" text,
  "onboarding_completed" boolean DEFAULT false NOT NULL,
  "onboarding_completed_at" timestamp,
  "settings" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
```

**Columns:**
- `id`: Unique workspace identifier
- `slack_team_id`: Slack team ID (for Slack workspaces)
- `discord_guild_id`: Discord server ID (for Discord servers)
- `platform_type`: "slack" | "discord" | "vscode"
- `bot_name`: Custom bot name (e.g., "Debo", "CodeBuddy")
- `bot_mention`: Generated mention handle (e.g., "@Debo")
- `onboarding_completed`: Whether onboarding is done
- `onboarding_completed_at`: Timestamp of onboarding completion
- `settings`: JSON settings for workspace preferences
- `created_at`, `updated_at`: Timestamps

## Troubleshooting

### Connection Refused

```powershell
# Check if PostgreSQL is running
Get-Service postgresql*

# Start if stopped
Start-Service postgresql-x64-14
```

### Migration Errors

```powershell
# Reset migrations (⚠️ WARNING: Drops all data)
psql -U postgres -d devbot -c "DROP SCHEMA public CASCADE;"
psql -U postgres -d devbot -c "CREATE SCHEMA public;"

# Re-run migrations
pnpm run db:migrate
```

### pgvector Not Found

```powershell
# Install pgvector extension
# Download from: https://github.com/pgvector/pgvector
# Or use Docker image with pgvector pre-installed (ankane/pgvector)
```

## Production Setup

### AWS RDS

1. Create PostgreSQL RDS instance (14+)
2. Enable pgvector extension
3. Update DATABASE_URL in production environment
4. Run migrations: `pnpm run db:migrate`

### Supabase

1. Create new Supabase project
2. pgvector is pre-installed
3. Get connection string from Supabase dashboard
4. Update DATABASE_URL
5. Run migrations

### Neon

1. Create Neon PostgreSQL database
2. Enable pgvector in Neon dashboard
3. Get connection string
4. Update DATABASE_URL
5. Run migrations

## Redis Setup (for BullMQ)

DevBot also uses Redis for job queuing:

```powershell
# Install Redis (Windows)
choco install redis-64

# Or use Docker
docker run -d --name devbot-redis -p 6379:6379 redis:alpine

# Update .env
REDIS_URL=redis://localhost:6379
```

## Complete Environment Variables

```bash
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/devbot
REDIS_URL=redis://localhost:6379

# Slack
SLACK_BOT_TOKEN=xoxb-your-token
SLACK_APP_TOKEN=xapp-your-token

# Discord
DISCORD_TOKEN=your-discord-token

# AI
ANTHROPIC_API_KEY=sk-ant-your-key

# GitHub
GITHUB_TOKEN=ghp_your-token
```

## Next Steps

After database setup:

1. ✅ Database configured
2. ✅ Migrations run
3. 📝 Test onboarding feature (see DEVBOT_ONBOARDING_TEST.md)
4. 📝 Deploy to Slack/Discord
5. 📝 Test in production

## Support

- **Documentation**: [DEVBOT_PERSONALIZATION_GUIDE.md](./DEVBOT_PERSONALIZATION_GUIDE.md)
- **Issues**: GitHub Issues
- **Email**: support@tolani-labs.com
