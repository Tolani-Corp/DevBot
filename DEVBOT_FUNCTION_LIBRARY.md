# DevBot Template System Integration Guide

**Version:** 2.0.0  
**Purpose:** Complete guide to using DevBot's template library and generation system  
**Status:** Production Ready

---

## 📖 Table of Contents

1. [System Overview](#-system-overview)
2. [Setup Instructions](#-setup-instructions)
3. [Using Templates](#-using-templates)
4. [API Reference](#-api-reference)
5. [DevBot Commands](#-devbot-commands)
6. [Real-World Examples](#-real-world-examples)
7. [Best Practices](#-best-practices)

---

## 🎯 System Overview

The DevBot Template System is a **managed library of production-ready React components** that integrate with DevBot's memory system. It allows you to:

✅ Store reusable component templates  
✅ Generate customized variations by tech stack  
✅ Build complete pages from template combinations  
✅ Track usage and maintain versions  
✅ Share templates across projects  

```
┌─────────────────────────────────────────────────┐
│         DevBot Memory System (PostgreSQL)       │
│  ┌───────────────────────────────────────────┐  │
│  │ templates table (25+ built-in)            │  │
│  │ template_versions (history tracking)       │  │
│  │ template_customizations (saved variants)  │  │
│  │ template_usage (analytics)                │  │
│  │ template_integrations (API/DB configs)    │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
         ↓
    templateManager.ts (Core Functions)
         ↓
    @DevBot Commands
```

---

## 🚀 Setup Instructions

### Step 1: Initialize Database Schema

```sql
-- Run in your PostgreSQL database
COPY FROM 'src/database/schema-templates.ts'

-- Or execute directly:
CREATE TABLE templates (...)
CREATE TABLE template_versions (...)
CREATE TABLE template_customizations (...)
-- See schema-templates.ts for complete SQL
```

### Step 2: Import Template Manager

```typescript
// In your DevBot functions
import templateManager from '@/functions/templateManager';

// Now available:
templateManager.storeTemplate()
templateManager.getTemplate()
templateManager.customizeTemplate()
templateManager.generateForStack()
// ... and more
```

### Step 3: Seed Built-in Templates

```typescript
import { seedBuiltInTemplates } from '@/functions/templates/seed';

// On first run:
await seedBuiltInTemplates();
```

---

## 📚 Using Templates

### 1. Get Available Templates

```typescript
// List all form templates
const formTemplates = await templateManager.listTemplatesByCategory('form');
console.log(formTemplates);
// Output: [
//   { id: 'contact-form-001', name: 'Contact Form', ... },
//   { id: 'login-form-001', name: 'Login Form', ... },
//   ...
// ]

// Search by name and tags
const results = await templateManager.searchTemplates(
  'form',
  ['validation', 'email'],
  'contact'
);
```

### 2. Retrieve Single Template

```typescript
const template = await templateManager.getTemplate('contact-form-001');

console.log(template);
// Output:
// {
//   id: 'contact-form-001',
//   name: 'Contact Form',
//   category: 'form',
//   code: '// Full React component code',
//   props: { name: 'string', email: 'string', ... },
//   dependencies: ['react', 'lucide-react'],
//   ...
// }

// Use it directly in your project:
import { ContactForm } from '@/components/templates/contact-form-001';
```

### 3. Customize a Template

```typescript
const customized = await templateManager.customizeTemplate({
  templateId: 'contact-form-001',
  changes: {
    colors: {
      primary: '#007bff',
      secondary: '#28a745',
      background: '#f8f9fa',
    },
    layout: 'vertical',
    size: 'large',
    features: ['captcha', 'file-upload', 'multi-language'],
    removals: ['remember-me'],
  },
});

console.log(customized.code); // Full customized component code
console.log(customized.changelog);
// Output:
// Updated colors: {"primary":"#007bff",...}
// Changed layout to: vertical
// Set size to: large
// Added features: captcha, file-upload, multi-language
// Removed features: remember-me
```

### 4. Generate Code for Different Stack

```typescript
// Convert React template to Vue 3
const vueVersion = await templateManager.generateForStack({
  templateId: 'contact-form-001',
  stackType: 'vue',
  customizations: {
    colors: { primary: '#007bff' },
  },
  integrations: ['stripe', 'sendgrid'],
});

// Output:
// {
//   code: '// Complete Vue 3 component with integrations',
//   framework: 'Vue 3'
// }
```

### 5. Generate Suggestions

```typescript
// AI-powered template suggestions
const suggested = await templateManager.suggestTemplates(
  'Build a SaaS admin dashboard with user management and analytics'
);

// Returns: [
//   AnalyticsDashboard,
//   DataTable,
//   UserManagementCard,
//   AuthenticationForm,
//   ...
// ]

// Auto-generate a complete page using suggestions
const page = await templateManager.generatePage('AdminDashboard', [
  'analytics-dashboard',
  'data-table',
  'navbar',
]);

console.log(page);
// Output:
// {
//   code: '// Complete AdminDashboard.tsx with all components assembled',
//   fileName: 'admin-dashboard.tsx'
// }
```

---

## 🔌 API Reference

### Core Functions

#### `storeTemplate(component: Omit<Component, 'id' | 'createdAt'>): Promise<Component>`

Store a new template in the database.

```typescript
const stored = await templateManager.storeTemplate({
  name: 'My Custom Form',
  category: 'form',
  description: 'Form with advanced validation',
  code: `export function MyForm() { ... }`,
  props: {
    onSubmit: 'function',
    initialValues: 'object',
  },
  dependencies: ['react', 'react-hook-form'],
  version: '1.0.0',
  tags: ['form', 'validation', 'custom'],
});

console.log(stored.id); // 'tmpl_1707862400000_a1b2c3d4e5'
```

#### `getTemplate(id: string): Promise<Component | null>`

Retrieve a template by ID.

```typescript
const template = await templateManager.getTemplate('contact-form-001');
if (!template) {
  console.log('Template not found');
}
```

#### `searchTemplates(category?: string, tags?: string[], query?: string): Promise<Component[]>`

Search templates with filters.

```typescript
// Complex search
const results = await templateManager.searchTemplates(
  'dashboard',
  ['analytics', 'real-time'],
  'performance'
);
```

#### `customizeTemplate(request: CustomizationRequest): Promise<{ code: string; changelog: string }>`

Generate customized version using Claude AI.

```typescript
// Fully type-safe customization
const { code, changelog } = await templateManager.customizeTemplate({
  templateId: 'login-form-001',
  changes: {
    colors: { primary: '#FF6B6B' },
    theme: 'dark',
    features: ['two-factor-auth', 'biometric-login'],
  },
});
```

#### `generateForStack(request: GenerationRequest): Promise<{ code: string; framework: string }>`

Generate code for different tech stack (Vue, Svelte, Python, Go, etc).

```typescript
// Generate Go backend version
const goBackend = await templateManager.generateForStack({
  templateId: 'rest-api-001',
  stackType: 'go',
  customizations: { size: 'large' },
  integrations: ['postgresql', 'redis', 'jwt'],
});

// Generate Svelte frontend version
const svelteUI = await templateManager.generateForStack({
  templateId: 'dashboard-001',
  stackType: 'svelte',
  integrations: ['websocket', 'real-time-updates'],
});
```

#### `suggestTemplates(useCase: string): Promise<Component[]>`

Get AI-recommended templates for a use case.

```typescript
const templates = await templateManager.suggestTemplates(
  "I need to build a real-time collaboration editor like Google Docs"
);
// Returns: [RichTextEditor, CollaborationToolbar, DocumentTable, ...]
```

#### `generatePage(pageName: string, components: string[]): Promise<{ code: string; fileName: string }>`

Assemble multiple templates into a complete page.

```typescript
const page = await templateManager.generatePage('UserProfile', [
  'profile-card',
  'edit-form',
  'activity-feed',
  'settings-panel',
]);

// Returns complete, wired-up page with state management
```

#### `updateTemplate(id: string, updates: Partial<Component>, changelog: string): Promise<Component>`

Update template and maintain version history.

```typescript
const updated = await templateManager.updateTemplate(
  'contact-form-001',
  {
    description: 'Enhanced contact form with reCAPTCHA',
    code: newCode,
    dependencies: ['react', 'react-google-recaptcha'],
    version: '1.1.0',
  },
  'Added reCAPTCHA support for spam prevention'
);
```

---

## 💬 DevBot Commands

Use these commands with DevBot (Slack, Discord, GitHub):

### Basic Commands

```
@DevBot list form templates
→ Shows all available form templates

@DevBot get template contact-form-001
→ Displays Contact Form template details and code

@DevBot search dashboard with analytics and real-time
→ Finds dashboards with those tags
```

### Customization Commands

```
@DevBot customize contact-form-001 with dark theme and blue colors
→ Generates dark-themed version with custom colors

@DevBot add stripe integration to login-form-001
→ Modifies login form to include payment flow

@DevBot convert contact-form-001 to vue
→ Generates Vue 3 version of component
```

### Generation Commands

```
@DevBot generate page AdminDashboard with analytics table navbar
→ Creates complete AdminDashboard.tsx with all components

@DevBot suggest templates for e-commerce checkout flow
→ AI recommends best templates for checkout

@DevBot build component suite for SaaS with auth and dashboard
→ Generates complete starter kit
```

### Management Commands

```
@DevBot store my component as template named "CustomForm"
→ Saves your code as reusable template

@DevBot update template contact-form-001 with changelog "Fixed email validation"
→ Updates template with new version

@DevBot export all templates as json
→ Backs up all templates to JSON

@DevBot show template statistics
→ Displays usage stats by category
```

---

## 📚 Real-World Examples

### Example 1: Build a Startup SaaS Onboarding

```typescript
// Scenario: New SaaS company needs onboarding flow

// Step 1: Get recommendations
const templates = await templateManager.suggestTemplates(
  'Multi-step onboarding flow with email verification and payment setup'
);
// Returns: [
//   MultiStepForm,
//   EmailVerificationCard,
//   PaymentForm,
//   ProgressIndicator,
// ]

// Step 2: Customize for brand colors
const customized = await Promise.all(
  templates.map(t =>
    templateManager.customizeTemplate({
      templateId: t.id,
      changes: {
        colors: {
          primary: '#6366f1', // Indigo
          secondary: '#8b5cf6', // Purple
        },
        theme: 'light',
      },
    })
  )
);

// Step 3: Generate complete page
const onboarding = await templateManager.generatePage('OnboardingFlow', [
  'multi-step-form',
  'email-verification',
  'payment-form',
  'progress-indicator',
]);

// Step 4: Deploy
fs.writeFileSync('pages/onboarding.tsx', onboarding.code);
// Done! Onboarding page is ready to deploy
```

### Example 2: Convert React to Go Backend

```typescript
// Scenario: React REST API client needs Go server implementation

// Get React template
const restApiTemplate = await templateManager.getTemplate('rest-api-client-001');

// Generate Go backend
const goBackend = await templateManager.generateForStack({
  templateId: restApiTemplate.id,
  stackType: 'go',
  integrations: ['postgresql', 'jwt', 'gorm'],
});

// Save generated code
fs.writeFileSync('api/main.go', goBackend.code);

// Generate OpenAPI docs
// Done! Go server matches React client expectations
```

### Example 3: Component Library for Multiple Teams

```typescript
// Scenario: 5 teams using different stacks need shared components

// Define shared components
const sharedComponents = [
  'button',
  'form-input',
  'data-table',
  'modal',
  'navbar',
];

// Generate for each stack
const stacks = ['react', 'vue', 'svelte', 'python', 'go'];

for (const component of sharedComponents) {
  const template = await templateManager.getTemplate(component);

  for (const stack of stacks) {
    const generated = await templateManager.generateForStack({
      templateId: template.id,
      stackType: stack as any,
    });

    fs.mkdirSync(`libraries/${stack}`, { recursive: true });
    fs.writeFileSync(
      `libraries/${stack}/${component}.${stack === 'python' ? 'py' : 'tsx'}`,
      generated.code
    );
  }
}

console.log(
  '✅ Component libraries generated for React, Vue, Svelte, Python, Go'
);
```

### Example 4: Template Marketplace

```typescript
// Scenario: Create internal template marketplace for organization

async function setupMarketplace() {
  // 1. Create collections
  const saasCollection = await db
    .insert(templateCollections)
    .values({
      id: 'col_saas_001',
      name: 'SaaS Starter Kit',
      description: 'Complete templates for building SaaS products',
      type: 'built-in',
      templates: [
        'landing-page',
        'auth-forms',
        'dashboard',
        'settings-panel',
        'billing-portal',
      ],
      isPublic: true,
      tags: ['saas', 'starter', 'complete'],
    });

  // 2. Get statistics
  const stats = await templateManager.getTemplateStats();
  console.log('📊 Marketplace Stats:', stats);
  // Output:
  // {
  //   totalTemplates: 45,
  //   byCategory: { form: 8, dashboard: 6, table: 5, ... },
  //   lastUpdated: 2026-02-13T00:00:00Z
  // }

  // 3. Export for backup
  const backup = await templateManager.exportAllTemplates();
  fs.writeFileSync('backups/templates.json', JSON.stringify(backup, null, 2));
}
```

---

## 🎯 Best Practices

### ✅ DO

1. **Name templates clearly**
   ```typescript
   ✅ 'contact-form-with-validation'
   ✅ 'analytics-dashboard-with-charts'
   ❌ 'form1'
   ❌ 'dashboard'
   ```

2. **Include comprehensive props**
   ```typescript
   ✅ Includes all component props with types
   ✅ Documents what each prop does
   ❌ Missing prop documentation
   ```

3. **Tag templates appropriately**
   ```typescript
   ✅ tags: ['form', 'validation', 'contact', 'email']
   ❌ tags: []
   ```

4. **Version incrementally**
   ```typescript
   ✅ 1.0.0 → 1.1.0 → 2.0.0 (major.minor.patch)
   ❌ 1.0 → 2.0
   ```

5. **Document changes**
   ```typescript
   ✅ changelog: "Added email validation regex, fixed button alignment"
   ❌ changelog: "updates"
   ```

### ❌ DON'T

1. Don't store secrets in templates
   ```typescript
   ❌ code: `const API_KEY = "sk_live_..."`
   ✅ code: `const API_KEY = process.env.API_KEY`
   ```

2. Don't include hardcoded data
   ```typescript
   ❌ code: `const users = [{id: 1, name: "John"}, ...]`
   ✅ code: `const [users, setUsers] = useState<User[]>([])`
   ```

3. Don't duplicate templates
   ```typescript
   ❌ Two nearly-identical form templates
   ✅ One template with customization options
   ```

4. Don't skip testing
   ```typescript
   ❌ Storing untested components
   ✅ Test all code before storing as template
   ```

5. Don't over-engineer
   ```typescript
   ❌ 500-line hyper-generic component
   ✅ 100-line focused component for single use case
   ```

---

## 🔍 Troubleshooting

### Issue: Template not found

```typescript
const template = await templateManager.getTemplate('invalid-id');
// Returns: null

// Solution: List available templates to find correct ID
const templates = await templateManager.listTemplatesByCategory('form');
templates.forEach(t => console.log(t.id)); // Find correct ID
```

### Issue: Customization not applying

```typescript
// Problem: Claude didn't recognize the customization request
// Solution: Be more specific in the request

const result = await templateManager.customizeTemplate({
  templateId: 'form-001',
  changes: {
    // ❌ Too vague
    colors: { primary: 'blue' },

    // ✅ More specific
    colors: {
      primary: '#007bff',
      secondary: '#6c757d',
      error: '#dc3545',
    },
  },
});
```

### Issue: Stack conversion failing

```typescript
// Problem: Stack type not supported
// Solution: Use supported stacks only

const supported = ['react', 'vue', 'svelte', 'python', 'go', 'rust'];

const result = await templateManager.generateForStack({
  templateId: 'form-001',
  stackType: supported[0], // Use valid stack
});
```

---

## 📊 Monitoring & Analytics

### Track Template Usage

```typescript
// The system automatically tracks:
// - How many times each template is used
// - Success/failure rates
// - User ratings (1-5 stars)
// - Projects using templates

const stats = await templateManager.getTemplateStats();
console.log(stats);
// Output:
// {
//   totalTemplates: 45,
//   byCategory: {
//     form: 8,
//     dashboard: 6,
//     table: 5,
//     auth: 4,
//     navigation: 3,
//     card: 7,
//     modal: 4,
//     layout: 8
//   },
//   lastUpdated: 2026-02-13T10:30:00Z
// }
```

### Export Usage Data

```typescript
// Get all templates with usage metrics
const allTemplates = await db.query.templates.findMany({
  with: {
    usage: true,
  },
});

// Analyze which templates are most popular
const popular = allTemplates.sort(
  (a, b) => (b.usage[0]?.usageCount || 0) - (a.usage[0]?.usageCount || 0)
);

console.log('Top 5 Templates:');
popular.slice(0, 5).forEach(t => {
  console.log(`${t.name}: ${t.usage[0]?.usageCount} uses`);
});
```

---

## 🎓 Learning Path

**Week 1-2: Fundamentals**
- [ ] Read DEVBOT_STACK_GUIDE.md
- [ ] Read DEVBOT_FRONTEND_TEMPLATES.md
- [ ] Try storing your first template
- [ ] Practice customization

**Week 3-4: Advanced**
- [ ] Stack conversion (React to Vue)
- [ ] Page assembly from templates
- [ ] Custom integrations
- [ ] Version management

**Week 5+: Mastery**
- [ ] Build template collections
- [ ] Create marketplace
- [ ] Automated component generation
- [ ] Template optimization

---

## 📞 Support & Resources

**Documentation Files:**
- `DEVBOT_STACK_GUIDE.md` - Tech stack recommendations
- `DEVBOT_FRONTEND_TEMPLATES.md` - Template code library
- `DEVBOT_FUNCTION_LIBRARY.md` - Function reference (this file)
- `DEVBOT_API_REFERENCE.md` - Complete API docs

**Example Projects:**
- `/examples/nextjs-saas-starter`
- `/examples/vue-dashboard`
- `/examples/python-backend`

**Community:**
- GitHub Discussions: github.com/tolani/devbot
- Slack: #devbot-templates channel
- Email: templates@tolani-labs.io

---

**Version:** 2.0.0  
**Status:** Production Ready  
**Last Updated:** 2026-02-13  
**Maintained by:** DevBot (@funbot)

