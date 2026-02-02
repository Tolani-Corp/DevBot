# Bot Factory: Individual Bot Blueprints

## 🤖 Blueprint Template

Each bot follows this structure:

```
Bot Name: @[Name]
Purpose: [1-line mission]
Owner: [Person responsible]
Status: [Planned/In Progress/Live]
Priority: [Critical/High/Medium/Low]

Capabilities: [List of key features]
Integrations: [External services]
Database Schema: [Core tables]
Slack Commands: [Available commands]
API Endpoints: [Internal APIs]
Launch Timeline: [Target date]
ROI: [Time saved/value delivered]
```

---

## Bot 1: @OpsBot 📋

**Purpose:** Centralized operations hub - tasks, calendar, workflows

**Owner:** @Terri (DevOps Lead)

**Status:** In Progress (Week 2)

**Core Capability Areas:**
- Task Management (Linear/Asana sync)
- Calendar Management (Google/Outlook sync)
- Workflow Automation (Zapier, Make.com)
- Team Standups & Reviews
- Document Management

**Database Schema:**
```sql
-- Tasks Table
CREATE TABLE ops_tasks (
  id SERIAL PRIMARY KEY,
  slack_user_id VARCHAR(255),
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMP,
  priority VARCHAR(10), -- P0, P1, P2, P3
  status VARCHAR(50), -- open, in_progress, done, blocked
  assigned_to VARCHAR(255),
  external_id VARCHAR(255), -- Linear/Asana ID
  external_source VARCHAR(50), -- linear, asana, jira
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(external_source, external_id)
);

-- Calendar Events Table
CREATE TABLE ops_calendar_events (
  id SERIAL PRIMARY KEY,
  slack_user_id VARCHAR(255),
  title TEXT,
  description TEXT,
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  calendar_provider VARCHAR(50), -- google, outlook, calendly
  external_id VARCHAR(255),
  attendees JSONB, -- Array of email addresses
  location TEXT,
  is_synced BOOLEAN DEFAULT false,
  synced_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Workflows Table
CREATE TABLE ops_workflows (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  trigger TEXT, -- Zapier/Make trigger
  trigger_config JSONB,
  actions JSONB, -- Array of action steps
  active BOOLEAN DEFAULT true,
  created_by VARCHAR(255),
  runs_count INTEGER DEFAULT 0,
  last_run_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Team Capacity Table
CREATE TABLE ops_team_capacity (
  id SERIAL PRIMARY KEY,
  week_start DATE,
  team_member_id VARCHAR(255),
  allocated_hours DECIMAL(5,2),
  available_hours DECIMAL(5,2),
  utilization_percent DECIMAL(5,2),
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Slack Commands:**
```
@OpsBot create task: [title]
  → Interactive modal for title, description, assignee, due date

@OpsBot assign [task_id] to @[person]
  → Syncs to Linear/Asana

@OpsBot schedule [meeting_name] for [time]
  → Creates calendar event, adds attendees

@OpsBot show my tasks
  → Lists all tasks assigned to user

@OpsBot what's due today?
  → Shows high-priority due items

@OpsBot weekly standup
  → Gathers updates from team, generates report

@OpsBot calendar: who's available [time]?
  → Checks Google Calendar for availability

@OpsBot remind me to [action] in [time]
  → Sets reminder via OpsBot

@OpsBot show blockers
  → Lists all blocked tasks with reasons

@OpsBot generate weekly report
  → Creates summary (tasks done, in progress, blockers)

@OpsBot create workflow: [trigger] → [action]
  → Sets up Zapier automation
```

**Integrations:**
- Task Management: Linear, Asana, Jira
- Calendar: Google Calendar, Outlook, Calendly
- Automation: Zapier, Make.com
- Documents: Notion, Confluence
- Meetings: Google Meet, Zoom, Loom

**Daily Workflow:**
```
9:00 AM:  Team standup via OpsBot
          All members submit: completed, in-progress, blockers
          OpsBot generates daily stand-up summary

2:00 PM:  Reminder: "2 high-priority items due today"

5:00 PM:  Weekly review (Fridays)
          Show: Tasks completed, velocity, blockers
          Calculate: Team capacity for next week
```

**API Endpoints:**
```
GET  /api/ops/tasks
GET  /api/ops/tasks/:id
POST /api/ops/tasks
PUT  /api/ops/tasks/:id
DELETE /api/ops/tasks/:id

GET  /api/ops/calendar/events
POST /api/ops/calendar/events
GET  /api/ops/calendar/availability?date=2026-02-15

GET  /api/ops/workflows
POST /api/ops/workflows
PUT  /api/ops/workflows/:id
DELETE /api/ops/workflows/:id

GET  /api/ops/team/capacity?week=2026-02-01
GET  /api/ops/team/blockers
```

**ROI:**
- **Time saved:** 3-4 hours/week per team member
- **Value:** $150-200/week per person
- **Team of 10:** $1,500-2,000/week = $78-104K/year

**Launch Timeline:** Week 2

---

## Bot 2: @BizBot 📊

**Purpose:** Business intelligence hub - KPIs, revenue, growth metrics

**Owner:** @Terri (Business/Product)

**Status:** Planned (Week 3)

**Core Metrics:**
- DAU (Daily Active Users)
- MRR (Monthly Recurring Revenue)
- ARR (Annual Recurring Revenue)
- Customer Acquisition Cost (CAC)
- Customer Lifetime Value (LTV)
- Churn Rate
- Net Revenue Retention (NRR)
- Burn Rate & Runway

**Database Schema:**
```sql
CREATE TABLE biz_kpi_metrics (
  id SERIAL PRIMARY KEY,
  metric_name VARCHAR(255), -- DAU, MRR, etc.
  metric_value DECIMAL(15,2),
  metric_date DATE,
  data_source VARCHAR(100), -- stripe, amplitude, custom
  previous_value DECIMAL(15,2),
  change_percent DECIMAL(5,2),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE biz_revenue_events (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(50), -- subscription, refund, churn
  customer_id VARCHAR(255),
  amount DECIMAL(10,2),
  currency VARCHAR(3),
  event_date TIMESTAMP,
  data_source VARCHAR(100), -- stripe
  external_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE biz_cohort_analysis (
  id SERIAL PRIMARY KEY,
  cohort_date DATE, -- When users signed up
  retention_day_1 DECIMAL(5,2),
  retention_day_7 DECIMAL(5,2),
  retention_day_30 DECIMAL(5,2),
  revenue_day_30 DECIMAL(10,2),
  churn_rate DECIMAL(5,2),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE biz_competitor_analysis (
  id SERIAL PRIMARY KEY,
  competitor_name VARCHAR(255),
  feature VARCHAR(255),
  status VARCHAR(50), -- have, missing, beta
  our_status VARCHAR(50),
  priority VARCHAR(20), -- p0, p1, p2, p3
  notes TEXT,
  checked_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Slack Commands:**
```
@BizBot show dashboard
  → Displays all key metrics

@BizBot what's our MRR trend?
  → Shows 30/90/360 day trend with % change

@BizBot revenue forecast for Q2
  → AI prediction based on historical data

@BizBot compare to [competitor]
  → Feature comparison matrix

@BizBot cohort analysis
  → Retention by signup cohort

@BizBot show LTV vs CAC
  → Ratio analysis (target: LTV:CAC > 3:1)

@BizBot top features by adoption
  → Ranked list by % of users using

@BizBot churn analysis: why are we losing customers?
  → AI analysis of churn reasons

@BizBot monthly board deck
  → Generates slides with metrics & insights
```

**Integrations:**
- Revenue: Stripe, Paddle, Gumroad
- Analytics: Amplitude, Mixpanel, Segment
- Data: Looker, Tableau, Mode Analytics
- Forecasting: Prophet (Facebook), custom ML models

**Daily Flow:**
```
6:00 AM:  Fetch overnight metrics from Stripe, Amplitude
          Calculate daily delta
          Store in database

7:00 AM:  BizBot alerts if key metrics changed >5%
          Example: "DAU down 8% vs yesterday"

9:00 AM:  Daily standup includes BizBot summary:
          - DAU: 2,341 ↑ 12%
          - MRR: $45K ↑ 8%
          - Churn: 2.1%
          - Runway: 18 months

Weekly:   Cohort analysis & retention report
Monthly:  Board presentation deck
```

**API Endpoints:**
```
GET  /api/biz/dashboard
GET  /api/biz/metrics/:metric_name
GET  /api/biz/metrics/:metric_name/trend?days=90
GET  /api/biz/forecast/:metric?quarters=4
GET  /api/biz/cohorts
GET  /api/biz/competitors
POST /api/biz/analysis/:type
```

**ROI:**
- **Time saved:** 5-10 hours/week on reporting
- **Value:** Better decision-making based on real data
- **Impact:** Identify growth opportunities, catch issues early

**Launch Timeline:** Week 3

---

## Bot 3: @FinBot 💰

**Purpose:** Financial operations - budgeting, accounting, ROI analysis

**Owner:** @Sarah (Finance/HR)

**Status:** Planned (Week 4)

**Capabilities:**
- Budget tracking & forecasting
- Expense approval workflow
- P&L reporting
- Contractor/vendor management
- Currency & payment processing
- ROI analysis on projects/tools
- Cost per user/metric analysis

**Database Schema:**
```sql
CREATE TABLE fin_budgets (
  id SERIAL PRIMARY KEY,
  department VARCHAR(100),
  category VARCHAR(100),
  budget_amount DECIMAL(12,2),
  spent_amount DECIMAL(12,2),
  period VARCHAR(20), -- Q1, Q2, month, year
  owner_id VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE fin_expenses (
  id SERIAL PRIMARY KEY,
  vendor VARCHAR(255),
  amount DECIMAL(10,2),
  currency VARCHAR(3),
  category VARCHAR(100),
  department VARCHAR(100),
  submitted_by VARCHAR(255),
  approved_by VARCHAR(255),
  status VARCHAR(50), -- pending, approved, rejected, paid
  receipt_url TEXT,
  external_id VARCHAR(255), -- QuickBooks ID
  expense_date DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE fin_roi_analysis (
  id SERIAL PRIMARY KEY,
  investment_name VARCHAR(255), -- "DevBot", "Hiring John", etc.
  investment_amount DECIMAL(12,2),
  investment_date DATE,
  expected_benefit DECIMAL(12,2), -- Annual benefit
  actual_benefit DECIMAL(12,2),
  roi_percent DECIMAL(10,2),
  payback_period_months INTEGER,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE fin_currency_rates (
  id SERIAL PRIMARY KEY,
  from_currency VARCHAR(3),
  to_currency VARCHAR(3),
  rate DECIMAL(15,6),
  rate_date DATE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Slack Commands:**
```
@FinBot show budget vs actual
  → Summary by department/category

@FinBot approve expense for @[person] ($[amount])
  → Creates approval workflow

@FinBot what's our burn rate?
  → Monthly spend vs revenue

@FinBot calculate ROI for [project]
  → Compares investment vs benefits

@FinBot cost per user metric
  → Calculates infrastructure cost/user

@FinBot monthly P&L
  → Profit & loss statement

@FinBot convert [amount] from [currency] to [currency]
  → Real-time currency conversion

@FinBot forecast budget: if we hire [n] engineers, cost?
  → Calculates total compensation + benefits

@FinBot show payment schedule
  → Upcoming payroll, invoices, vendor payments

@FinBot generate finance report for [month]
  → Comprehensive financial summary
```

**Integrations:**
- Accounting: QuickBooks, Wave, Xero
- Payment: Stripe, Wise, PayPal
- HR: BambooHR (salary data)
- Time Tracking: Clockify, Toggl
- Rates: OANDA, Open Exchange Rates

**Daily Flow:**
```
Daily:    Monitor budget spend
          Alert if category exceeds 80% budget

Weekly:   Summary by department
          Show highest spenders

Monthly:  P&L report
          Reconcile with accounting software
          Calculate burn rate & runway

Quarterly: ROI analysis on investments
           Strategic expense review
           Board reporting
```

**API Endpoints:**
```
GET  /api/fin/budget/current
POST /api/fin/expenses
GET  /api/fin/expenses/:id
PUT  /api/fin/expenses/:id/approve
GET  /api/fin/reports/p-and-l
GET  /api/fin/roi/:investment_id
POST /api/fin/currency/convert?from=USD&to=EUR&amount=1000
```

**ROI:**
- **Time saved:** 4-6 hours/week on accounting
- **Value:** Better financial visibility, catch budget overruns
- **Impact:** Make smarter spending decisions

**Launch Timeline:** Week 4

---

## Bot 4: @HRBot (@Sarah) 👥

**Purpose:** HR & People Operations - recruiting, comp, culture

**Owner:** @Sarah (HR Lead)

**Status:** Planned (Week 7)

**Capabilities:**
- Job posting & candidate tracking
- Skills assessment & matching
- Compensation analysis
- Performance review scheduling
- Benefits & perks management
- Team org chart & reporting
- Culture & engagement tracking

**Database Schema:**
```sql
CREATE TABLE hr_jobs (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255),
  description TEXT,
  level VARCHAR(50), -- junior, mid, senior, lead
  department VARCHAR(100),
  salary_min DECIMAL(12,2),
  salary_max DECIMAL(12,2),
  status VARCHAR(50), -- open, closed, filled
  posted_date DATE,
  external_id VARCHAR(255), -- Greenhouse ID
  applications_count INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE hr_candidates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(20),
  job_id INTEGER REFERENCES hr_jobs(id),
  resume_url TEXT,
  status VARCHAR(50), -- applied, phone, interview, offer, hired, rejected
  stage VARCHAR(50),
  score_technical DECIMAL(3,1),
  score_culture_fit DECIMAL(3,1),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE hr_compensation (
  id SERIAL PRIMARY KEY,
  employee_id VARCHAR(255),
  role VARCHAR(255),
  salary DECIMAL(12,2),
  bonus_percent DECIMAL(5,2),
  equity_shares DECIMAL(10,2),
  total_comp DECIMAL(12,2),
  market_rate DECIMAL(12,2), -- from Guidepoint
  percentile DECIMAL(5,2), -- 50th, 75th, etc.
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE hr_performance_reviews (
  id SERIAL PRIMARY KEY,
  employee_id VARCHAR(255),
  reviewer_id VARCHAR(255),
  period_start_date DATE,
  period_end_date DATE,
  rating DECIMAL(3,1), -- 1-5
  strengths TEXT,
  growth_areas TEXT,
  next_goals TEXT,
  status VARCHAR(50), -- pending, completed
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Slack Commands:**
```
@HRBot post job for [role]
  → Creates job posting on Greenhouse/Lever

@HRBot show candidates for [job_title]
  → Lists candidates with scores

@HRBot schedule interview with @[candidate]
  → Adds to calendar, sends invite

@HRBot comp analysis for [role]
  → Shows market rate vs our offer

@HRBot org chart
  → Shows reporting structure

@HRBot schedule performance reviews
  → Creates review cycles for team

@HRBot show open positions
  → List of hiring targets

@HRBot calculate total comp for new hire
  → Salary + bonus + equity + benefits

@HRBot team headcount
  → Show team size, budget for hiring

@HRBot generate diversity report
  → Show demographics of team
```

**Integrations:**
- ATS: Greenhouse, Lever, Workable
- HR: BambooHR, Guidepoint, Rippling
- Calendar: Google Calendar
- Compensation: Guidepoint, PayScale
- Communication: Slack

**Daily Flow:**
```
Daily:    Application notifications
          New candidates in pipeline

Weekly:   Interview schedule
          Offer tracking
          Candidate pipeline summary

Monthly:  Hiring forecast
          Diversity metrics
          Compensation adjustments

Quarterly: Performance review cycle
           Promotion recommendations
           Comp adjustments
```

**ROI:**
- **Time saved:** 3-4 hours/week on recruiting/HR
- **Value:** Faster hiring, better comp decisions, team satisfaction
- **Impact:** Build great team, reduce turnover

**Launch Timeline:** Week 7

---

## Bot 5: @Cyrus 🌟

**Purpose:** Daily motivation, philosophy, mindset coaching

**Owner:** @Terri (Culture Lead)

**Status:** Planned (Week 8)

**Capabilities:**
- Daily inspirational quotes
- Mindfulness & focus sessions
- Goal tracking & reflection
- Team motivation campaigns
- Browser/OS extension notifications
- Weekly progress summaries

**Database Schema:**
```sql
CREATE TABLE cyrus_quotes (
  id SERIAL PRIMARY KEY,
  text TEXT NOT NULL,
  author VARCHAR(255),
  theme VARCHAR(100), -- stoicism, motivation, wisdom
  source VARCHAR(100), -- book, person, philosophy
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE cyrus_user_goals (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255),
  goal TEXT,
  category VARCHAR(50), -- personal, professional
  target_date DATE,
  status VARCHAR(50), -- in_progress, completed, abandoned
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE cyrus_reflections (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255),
  date DATE,
  reflection_text TEXT,
  mood VARCHAR(50), -- great, good, okay, bad
  energy_level INTEGER, -- 1-10
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE cyrus_team_motivation (
  id SERIAL PRIMARY KEY,
  date DATE,
  type VARCHAR(50), -- daily, sprint, milestone
  message TEXT,
  delivered BOOLEAN DEFAULT false,
  reactions JSONB, -- emoji reactions count
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Slack Commands:**
```
@Cyrus send me motivation
  → Random inspirational quote

@Cyrus daily philosophy
  → Stoic/wisdom lesson for the day

@Cyrus team motivation for [event]
  → Motivational message for team

@Cyrus goal check-in
  → Reflection on weekly goals

@Cyrus reflection: [what happened today]
  → Journaling prompt

@Cyrus show my motivation score
  → Weekly engagement summary

@Cyrus stoic wisdom
  → Marcus Aurelius, Seneca, Epictetus quotes

@Cyrus mindfulness: 5 min
  → Guided focus session (desktop app)
```

**Browser/OS Extension Features:**
```
Chrome Extension:
- Morning motivation quote (system tray)
- Afternoon energy boost quote
- Evening reflection prompt
- Focus mode timer (25 min) with philosophy passage
- Weekly goal tracker
- Daily check-in: "Did I make progress?"

Windows 10/11 Toast Notifications:
- 9 AM: "Your morning motivation"
- 12 PM: "Lunch break reflection"
- 5 PM: "Evening focus message"

Mac Notifications:
- Similar flow to Windows

Browser Popup:
- Click Cyrus icon → Today's quote
- Click + button → Log reflection
- Calendar view → See mood trends
```

**Integrations:**
- Slack: Direct messages, reactions
- Browser: Chrome, Firefox, Edge
- OS: Windows, Mac, Linux (via electron app)
- Data: User reflections, mood tracking

**Daily Flow:**
```
6:00 AM:  Send morning motivation (time-zone aware)
          Inspirational quote + philosophy lesson

12:00 PM: Lunchtime reflection
          "What's your biggest win so far today?"

5:00 PM:  End-of-day reflection
          "One thing to be grateful for?"

Sunday:   Weekly review
          Show mood trends, goal progress
          Motivational summary for week ahead

Monthly:  Reflection digest
          Show themes, patterns, growth areas
```

**ROI:**
- **Impact:** 10-15 min/day boost in morale & focus
- **Value:** Better team culture, reduced burnout
- **Cost:** Low (mostly philosophical quotes, open source)

**Launch Timeline:** Week 8

---

## Bots 6-10: Brief Overview

### Bot 6: @BuzzBot 📢
- Schedule social posts (Twitter, LinkedIn)
- Track engagement & virality
- Content calendar planning
- Email campaign management
- Launch week 5

### Bot 7: @PRBot (@Brad) 📰
- Daily industry news
- Competitor tracking
- Speaking opportunities
- Press mentions
- Launch week 6

### Bot 8: @LegalBot ⚖️
- Contract management
- Compliance tracking
- Deadline alerts
- Legal spend management
- Launch week 9

### Bot 9: @AuthBot 🔐
- Access control management
- Security incident response
- Vulnerability scanning
- Audit logging
- Launch week 2.5

### Bot 10: @DevBot ⭐ (LIVE NOW)
- Code automation
- PR creation
- Testing & documentation
- Health monitoring
- Launched!

---

## 🎯 Summary: Bot Factory by Phase

**Phase 1 (Week 1-2):** DevBot, OpsBot, AuthBot
**Phase 2 (Week 3-4):** BizBot, FinBot
**Phase 3 (Week 5-6):** BuzzBot, PRBot
**Phase 4 (Week 7-8):** HRBot, Cyrus
**Phase 5 (Week 9+):** LegalBot, Advanced automation

**Result:** Fully automated Tolani Labs operations by Month 2. 🚀

---

*Bot Factory: The future of work.* 🤖🏭
