# DevBot Personalization - Next Steps Guide

## ✅ Completed So Far

1. ✅ **Feature Implementation**
   - Database schema with `workspaces` table
   - Onboarding service with full API
   - Slack bot integration
   - Discord bot integration
   - Comprehensive documentation

2. ✅ **Documentation Created**
   - [DEVBOT_PERSONALIZATION_GUIDE.md](./DEVBOT_PERSONALIZATION_GUIDE.md) - Full feature guide
   - [DEVBOT_PERSONALIZATION_QUICK_REF.md](./DEVBOT_PERSONALIZATION_QUICK_REF.md) - Quick reference
   - [DATABASE_SETUP.md](./DATABASE_SETUP.md) - Database setup instructions
   - Updated [README.md](./README.md) with personalization feature

3. ✅ **Testing Infrastructure**
   - Test suite created: `tests/onboarding.test.ts`
   - Database migration: `drizzle/0000_parched_doorman.sql`
   - NPM scripts added: `test:onboarding`, `db:generate`

4. ✅ **Code Pushed to GitHub**
   - Commit `cf01f93`: Bot personalization feature
   - Commit `303cd20`: Documentation and tests
   - All files on GitHub main branch

---

## 🚀 Next Steps (In Order)

### Step 1: Database Setup (15-30 minutes)

Choose one option:

**Option A: Local PostgreSQL (Recommended for development)**

```powershell
# 1. Install PostgreSQL (if not installed)
choco install postgresql

# 2. Start PostgreSQL service
Start-Service postgresql-x64-14

# 3. Create database
psql -U postgres -c "CREATE DATABASE devbot;"

# 4. Enable pgvector extension
psql -U postgres -d devbot -c "CREATE EXTENSION IF NOT EXISTS vector;"

# 5. Update .env file
# DATABASE_URL=postgresql://postgres:your_password@localhost:5432/devbot
```

**Option B: Docker (Easiest)**

```powershell
# 1. Pull and run PostgreSQL with pgvector
docker run -d `
  --name devbot-postgres `
  -e POSTGRES_DB=devbot `
  -e POSTGRES_USER=devbot `
  -e POSTGRES_PASSWORD=devbot123 `
  -p 5432:5432 `
  ankane/pgvector

# 2. Update .env file
# DATABASE_URL=postgresql://devbot:devbot123@localhost:5432/devbot
```

**Option C: Cloud Database (For production)**

- **Supabase** (easiest): Create project, get connection string
- **AWS RDS**: Create PostgreSQL instance, enable pgvector
- **Neon**: Create database, get connection string

📖 **Detailed instructions:** [DATABASE_SETUP.md](./DATABASE_SETUP.md)

---

### Step 2: Run Database Migrations (2 minutes)

```powershell
cd C:\Users\terri\Projects\DevBot

# Install dependencies (if needed)
pnpm install

# Run migrations to create all tables
pnpm run db:migrate
```

**Expected output:**
```
Applying migrations...
✓ 0000_parched_doorman.sql applied
```

**Verify tables created:**
```powershell
psql -U postgres -d devbot -c "\dt"
```

Should show:
- `audit_logs`
- `conversations`
- `document_embeddings`
- `documents`
- `tasks`
- `workspaces` ← New table!

---

### Step 3: Run Onboarding Tests (5 minutes)

Test the personalization feature without deploying:

```powershell
# Make sure DATABASE_URL is set in .env
# Then run the test suite
pnpm run test:onboarding
```

**Expected output:**
```
🧪 DevBot Onboarding Test Suite

📱 Testing Slack Onboarding...
✅ Test 1: Check onboarding needed - PASS
✅ Test 2: Create workspace - PASS
✅ Test 3: Complete onboarding with custom name - PASS
✅ Test 4: Verify onboarding not needed after completion - PASS
✅ Test 5: Get bot name - PASS
✅ Test 6: Update bot name - PASS

🎮 Testing Discord Onboarding...
✅ All tests passed!

🎉 ALL TESTS PASSED!
```

If tests fail, check:
- DATABASE_URL is correct in `.env`
- PostgreSQL is running
- pgvector extension is installed

---

### Step 4: Setup Redis (Optional, for job queue) (5 minutes)

DevBot uses Redis for background task processing.

**Option A: Install Redis locally**
```powershell
choco install redis-64
# Update .env: REDIS_URL=redis://localhost:6379
```

**Option B: Docker**
```powershell
docker run -d --name devbot-redis -p 6379:6379 redis:alpine
# Update .env: REDIS_URL=redis://localhost:6379
```

**Option C: Cloud Redis**
- Redis Labs (free tier)
- AWS ElastiCache
- Upstash

---

### Step 5: Test Locally (Development Mode) (10 minutes)

Test the bot in development mode before deploying:

```powershell
# Terminal 1: Start the Slack bot
cd C:\Users\terri\Projects\DevBot
pnpm dev

# Terminal 2: Start the worker (for background tasks)
pnpm worker
```

**For Slack Testing:**

1. Make sure you have Slack app configured (see [SLACK_APP_SETUP.md](./SLACK_APP_SETUP.md))
2. Add bot to your Slack workspace
3. Mention the bot: `@DevBot`
4. You should see the onboarding message!
5. Reply with a custom name: `Debo`
6. Confirm the name change worked
7. Test rename: `@Debo rename bot`

**For Discord Testing:**

1. Make sure DISCORD_TOKEN is in `.env`
2. Bot should auto-connect when you run `pnpm dev`
3. Mention bot in Discord server
4. Follow onboarding flow

---

### Step 6: Production Deployment (30-60 minutes)

Once tested locally, deploy to production:

**Option A: Deploy to Render/Railway/Fly.io**

1. Push code to GitHub (already done ✅)
2. Create new service on your platform
3. Connect to GitHub repo
4. Set environment variables:
   ```
   DATABASE_URL=your_production_postgres_url
   REDIS_URL=your_production_redis_url
   SLACK_BOT_TOKEN=your_token
   SLACK_APP_TOKEN=your_token
   ANTHROPIC_API_KEY=your_key
   GITHUB_TOKEN=your_token
   ```
5. Deploy!

**Option B: Docker Deployment**

```powershell
# Build image
docker build -t devbot:latest .

# Run container
docker run -d `
  --name devbot `
  --env-file .env `
  -p 3100:3100 `
  devbot:latest

# Also run worker
docker run -d `
  --name devbot-worker `
  --env-file .env `
  devbot:latest `
  npm run worker:prod
```

**Option C: Traditional VPS**

1. SSH into server
2. Install Node.js 22+, PostgreSQL, Redis
3. Clone repo
4. Setup `.env`
5. Run migrations
6. Use PM2 for process management:
   ```bash
   pm2 start pnpm --name devbot-bot -- dev
   pm2 start pnpm --name devbot-worker -- worker
   ```

---

### Step 7: Test in Production (10 minutes)

After deployment:

1. **Slack:**
   - Join a new Slack workspace (or clear existing workspace data in DB)
   - Mention `@DevBot`
   - Verify onboarding message appears
   - Complete onboarding with custom name
   - Test bot functionality
   - Test rename command

2. **Discord:**
   - Add bot to Discord server
   - Mention bot
   - Verify onboarding
   - Test functionality

3. **Database:**
   - Check workspaces table has entries
   - Verify bot_name is custom name
   - Check onboarding_completed is true

---

## 📝 Quick Command Reference

```powershell
# Database
pnpm run db:migrate          # Run migrations
pnpm run db:generate         # Generate new migration from schema

# Testing
pnpm run test:onboarding     # Test onboarding feature
pnpm run test                # Run all tests

# Development
pnpm dev                     # Start Slack/Discord bots
pnpm worker                  # Start background worker
pnpm run check               # Type-check TypeScript

# Production
pnpm build                   # Build for production
pnpm start                   # Run production bot
pnpm run worker:prod         # Run production worker
```

---

## 🐛 Troubleshooting

### Database Connection Failed

**Symptoms:** `Error: connect ECONNREFUSED 127.0.0.1:5432`

**Solutions:**
1. Check PostgreSQL is running: `Get-Service postgresql*`
2. Start service: `Start-Service postgresql-x64-14`
3. Verify DATABASE_URL in `.env`
4. Test connection: `psql -U postgres -d devbot`

### Migration Failed

**Symptoms:** `Error: relation "workspaces" already exists`

**Solutions:**
1. Check if tables exist: `psql -U postgres -d devbot -c "\dt"`
2. If tables exist, skip migration (already applied)
3. To reset (⚠️ DELETES DATA): 
   ```sql
   DROP SCHEMA public CASCADE;
   CREATE SCHEMA public;
   ```
   Then run: `pnpm run db:migrate`

### Onboarding Test Failed

**Symptoms:** Test suite fails with database errors

**Solutions:**
1. Verify DATABASE_URL is correct
2. Run migrations first: `pnpm run db:migrate`
3. Check PostgreSQL has pgvector: `psql -U postgres -d devbot -c "\dx"`
4. Clear test data: 
   ```sql
   DELETE FROM workspaces WHERE slack_team_id LIKE '%TEST%';
   ```

### Bot Not Responding

**Symptoms:** Bot doesn't reply to mentions

**Solutions:**
1. Check bot is running: Logs should show "FunBot Slack app is running"
2. Verify Slack tokens in `.env`
3. Check bot has correct permissions in Slack
4. Test with: `@DevBot` (empty message should show help)
5. Check worker is running for background tasks

### Onboarding Not Showing

**Symptoms:** No onboarding message on first mention

**Solutions:**
1. Check if workspace already in database:
   ```sql
   SELECT * FROM workspaces WHERE slack_team_id = 'YOUR_TEAM_ID';
   ```
2. Clear workspace data to restart onboarding:
   ```sql
   DELETE FROM workspaces WHERE slack_team_id = 'YOUR_TEAM_ID';
   ```
3. Mention bot again: `@DevBot`

---

## 📊 Monitoring Onboarding

### Check Workspaces

```sql
-- See all workspaces
SELECT 
  id,
  platform_type,
  bot_name,
  onboarding_completed,
  created_at
FROM workspaces
ORDER BY created_at DESC;

-- See workspaces that completed onboarding
SELECT bot_name, platform_type, onboarding_completed_at
FROM workspaces
WHERE onboarding_completed = true;

-- See custom bot names
SELECT DISTINCT bot_name, COUNT(*) as count
FROM workspaces
GROUP BY bot_name
ORDER BY count DESC;
```

### Check Logs

```powershell
# Development
# Logs appear in terminal running `pnpm dev`

# Production (PM2)
pm2 logs devbot-bot
pm2 logs devbot-worker

# Docker
docker logs devbot
docker logs devbot-worker
```

---

## 🎯 Success Criteria

You'll know it's working when:

1. ✅ Tests pass: `pnpm run test:onboarding` shows all green
2. ✅ Database has workspaces table with correct schema
3. ✅ Bot shows onboarding message on first mention
4. ✅ Bot accepts custom name and saves to database
5. ✅ Bot uses custom name in all responses
6. ✅ Rename command works to change name anytime
7. ✅ Multiple workspaces can have different custom names

---

## 📚 Additional Resources

- **Personalization Guide**: [DEVBOT_PERSONALIZATION_GUIDE.md](./DEVBOT_PERSONALIZATION_GUIDE.md)
- **Quick Reference**: [DEVBOT_PERSONALIZATION_QUICK_REF.md](./DEVBOT_PERSONALIZATION_QUICK_REF.md)
- **Database Setup**: [DATABASE_SETUP.md](./DATABASE_SETUP.md)
- **Slack Setup**: [SLACK_APP_SETUP.md](./SLACK_APP_SETUP.md)
- **Main README**: [README.md](./README.md)

---

## 🚀 What's Next?

After completing these steps, consider:

1. **Add More Platforms**: Extend to VS Code extension, Teams, etc.
2. **Enhance Personalization**: Add avatar customization, personality settings
3. **Team Features**: Let teams vote on bot name
4. **Analytics**: Track most popular bot names
5. **Name History**: Show name change history
6. **Themes**: Let users customize bot response style

---

## 💬 Need Help?

- **GitHub Issues**: Open issue in DevBot repo
- **Documentation**: Check guides above
- **Email**: support@tolani-labs.com
- **Slack**: #devbot-support channel

**Current Status:** ✅ Feature complete and ready to deploy!

**Estimated Time to Production:** 1-2 hours (including database setup and testing)
