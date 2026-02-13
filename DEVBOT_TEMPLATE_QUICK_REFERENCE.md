# DevBot Template System - Quick Reference & Implementation Guide

**Version:** 2.0.0  
**Type:** Developer Reference  
**Last Updated:** 2026-02-13

---

## 🚀 Quick Start (5 Minutes)

### 1. Install & Configure

```bash
# Add to your DevBot installation
npm install template-manager drizzle-orm pg

# Update database
psql -f src/database/schema-templates.sql
```

### 2. Seed Templates

```typescript
import { seedTemplates } from '@/functions/templates/seed';
await seedTemplates();
// ✅ 25+ templates loaded
```

### 3. Use in Chat

```
@DevBot customize contact-form-001 with dark theme
@DevBot generate page Dashboard with analytics and table
@DevBot suggest templates for e-commerce
```

---

## 📋 Template Usage Matrix

| Use Case | Recommended Template | Stack | Time |
|----------|---------------------|-------|------|
| Landing page | `landing-page-001` | React/Next | 30min |
| User login | `login-form-001` | React/Vue | 15min |
| Admin dashboard | `admin-dashboard-001` | React/Next | 2hrs |
| Data management | `data-table-001` | Any | 1hr |
| Settings panel | `settings-panel-001` | React/Vue | 45min |
| Billing portal | `billing-portal-001` | Next.js | 3hrs |
| Real-time chat | `chat-interface-001` | React + WebSocket | 4hrs |
| File upload | `file-upload-001` | Next.js + S3 | 1.5hrs |

---

## 🎯 Implementation Examples

### Example 1: Contact Form (React)

```typescript
// Step 1: Import template
import templateManager from '@/functions/templateManager';

// Step 2: Get template
const template = await templateManager.getTemplate('contact-form-001');

// Step 3: Use directly
export async function MyPage() {
  return (
    <div>
      <h1>Contact Us</h1>
      {/* template.code contains: <ContactForm onSubmit={handleSubmit} /> */}
    </div>
  );
}
```

### Example 2: Dashboard (Multi-Template)

```typescript
class DashboardBuilder {
  async buildDashboard() {
    // Get multiple templates
    const templates = await templateManager.suggestTemplates(
      'analytics dashboard with real-time data'
    );

    // Customize each
    const customized = await Promise.all(
      templates.map(t =>
        templateManager.customizeTemplate({
          templateId: t.id,
          changes: { theme: 'dark', colors: { primary: '#6366f1' } },
        })
      )
    );

    // Assemble into page
    const page = await templateManager.generatePage('Dashboard', [
      'analytics-dashboard',
      'data-table',
      'navbar',
    ]);

    return page.code;
  }
}
```

### Example 3: Multi-Stack Deployment

```typescript
class MultiStackDeployer {
  async deployAcrossStacks() {
    const stacks = ['react', 'vue', 'svelte'];
    const results = new Map();

    for (const stack of stacks) {
      const code = await templateManager.generateForStack({
        templateId: 'contact-form-001',
        stackType: stack as any,
        integrations: ['email', 'database'],
      });

      results.set(stack, code.code);
      // Write to appropriate directory for each stack
    }

    return results;
  }
}
```

### Example 4: Template Customization Workflow

```typescript
interface CustomizationStep {
  name: string;
  changes: Record<string, any>;
}

class CustomizationWorkflow {
  steps: CustomizationStep[] = [
    {
      name: 'Branding',
      changes: {
        colors: {
          primary: '#FF6B6B',
          secondary: '#4ECDC4',
          accent: '#95E1D3',
        },
      },
    },
    {
      name: 'Features',
      changes: {
        features: ['validation', 'file-upload', 'markdown'],
      },
    },
    {
      name: 'Theme',
      changes: {
        theme: 'dark',
        layout: 'vertical',
      },
    },
  ];

  async applyWorkflow(templateId: string) {
    let code = (await templateManager.getTemplate(templateId))?.code;

    for (const step of this.steps) {
      const result = await templateManager.customizeTemplate({
        templateId,
        changes: step.changes,
      });
      code = result.code;
      console.log(`✅ Applied: ${step.name}`);
    }

    return code;
  }
}
```

---

## 🔧 Function Reference (Cheat Sheet)

### Storage Functions

```typescript
// Store new template
const stored = await templateManager.storeTemplate({
  name: 'My Form',
  category: 'form',
  code: '...',
  // ... other props
});

// Get template
const template = await templateManager.getTemplate('id');

// List by category
const forms = await templateManager.listTemplatesByCategory('form');

// Search
const results = await templateManager.searchTemplates(
  'form', // category optional
  ['validation'], // tags optional
  'contact' // query optional
);
```

### Customization Functions

```typescript
// Customize appearance/features
const custom = await templateManager.customizeTemplate({
  templateId: 'form-001',
  changes: {
    colors: { primary: '#007bff' },
    theme: 'dark',
    features: ['validation'],
  },
});

// Generate for different stack
const vue = await templateManager.generateForStack({
  templateId: 'form-001',
  stackType: 'vue',
  integrations: ['email'],
});
```

### Intelligence Functions

```typescript
// Get AI suggestions
const suggested = await templateManager.suggestTemplates(
  'Build a checkout flow'
);

// Generate complete page
const page = await templateManager.generatePage('Checkout', [
  'cart-review',
  'payment-form',
  'confirmation',
]);

// Get component suite
const suite = await templateManager.generateComponentSuite('MyApp', {
  needsAuth: true,
  needsDashboard: true,
  theme: 'dark',
});
```

### Version Management

```typescript
// Update template
const updated = await templateManager.updateTemplate(
  'form-001',
  { code: newCode, description: 'Updated' },
  'Fixed validation bug'
);

// Get version history
const history = await templateManager.getTemplateHistory('form-001');

// Export all
const backup = await templateManager.exportAllTemplates();

// Get stats
const stats = await templateManager.getTemplateStats();
```

---

## 🎯 Common Patterns

### Pattern 1: Form + Validation

```typescript
const form = await templateManager.getTemplate('form-with-validation');
const customized = await templateManager.customizeTemplate({
  templateId: form.id,
  changes: {
    features: ['email-validation', 'phone-validation', 'custom-rules'],
  },
});
```

### Pattern 2: Dashboard + Analytics

```typescript
const dashboards = await templateManager.suggestTemplates(
  'analytics dashboard'
);

const withCharts = await Promise.all(
  dashboards.map(d =>
    templateManager.customizeTemplate({
      templateId: d.id,
      changes: { features: ['charts', 'real-time', 'export'] },
    })
  )
);
```

### Pattern 3: Full App Assembly

```typescript
const pages = {
  landing: 'landing-page-001',
  auth: 'auth-flow-001',
  dashboard: 'admin-dashboard-001',
  settings: 'settings-panel-001',
};

for (const [pageName, templateId] of Object.entries(pages)) {
  const code = await templateManager.generatePage(pageName, [templateId]);
  saveFile(`pages/${code.fileName}`, code.code);
}
```

### Pattern 4: Mobile Responsive

```typescript
const base = await templateManager.getTemplate('form-001');

const responsive = await templateManager.customizeTemplate({
  templateId: base.id,
  changes: {
    features: ['mobile-responsive', 'touch-optimized'],
    layout: 'responsive',
  },
});
```

---

## ❌ Common Mistakes & Solutions

| Mistake | Solution |
|---------|----------|
| Using hardcoded ID | Use `searchTemplates()` to find dynamic IDs |
| Ignoring dependencies | Check `template.dependencies` before use |
| Not validating props | Reference `template.props` for type safety |
| Direct template mutation | Use `customizeTemplate()` instead |
| Missing error handling | Wrap calls in try-catch, check for null |
| Large customizations | Break into multiple smaller customizations |
| Not versioning changes | Always use `updateTemplate()` with changelog |

---

## 📊 Performance Optimization

### Caching Templates

```typescript
class TemplateCache {
  private cache = new Map<string, Component>();
  private maxAge = 1000 * 60 * 60; // 1 hour

  async get(id: string) {
    if (this.cache.has(id)) {
      return this.cache.get(id);
    }

    const template = await templateManager.getTemplate(id);
    this.cache.set(id, template as Component);

    setTimeout(() => this.cache.delete(id), this.maxAge);
    return template;
  }
}
```

### Batch Operations

```typescript
// Bad: Sequential calls
for (const id of templateIds) {
  const template = await templateManager.getTemplate(id);
}

// Good: Parallel calls
const templates = await Promise.all(
  templateIds.map(id => templateManager.getTemplate(id))
);
```

### Lazy Loading

```typescript
// Load templates on demand
async function* templateGenerator(category: string) {
  const templates = await templateManager.listTemplatesByCategory(category);
  for (const template of templates) {
    yield template;
  }
}
```

---

## 🧪 Testing Templates

### Unit Tests

```typescript
import { describe, it, expect } from 'vitest';
import templateManager from '@/functions/templateManager';

describe('Template Manager', () => {
  it('stores and retrieves templates', async () => {
    const stored = await templateManager.storeTemplate({
      name: 'Test Form',
      category: 'form',
      description: 'Test',
      code: 'export function TestForm() {}',
      props: {},
      dependencies: [],
      version: '1.0.0',
      tags: [],
    });

    const retrieved = await templateManager.getTemplate(stored.id);
    expect(retrieved?.name).toBe('Test Form');
  });

  it('customizes templates', async () => {
    const customized = await templateManager.customizeTemplate({
      templateId: 'form-001',
      changes: { colors: { primary: '#FF0000' } },
    });

    expect(customized.code).toContain('#FF0000');
  });

  it('generates for different stacks', async () => {
    const vue = await templateManager.generateForStack({
      templateId: 'form-001',
      stackType: 'vue',
    });

    expect(vue.framework).toBe('Vue 3');
    expect(vue.code).toContain('v-model');
  });
});
```

---

## 📱 Integration with DevBot Commands

```typescript
// DevBot command handler
@Command('template')
async handleTemplateCommand(args: string[]) {
  const [action, ...params] = args;

  switch (action) {
    case 'list':
      const templates = await templateManager.listTemplatesByCategory(params[0]);
      return this.formatTemplateList(templates);

    case 'customize':
      const customized = await templateManager.customizeTemplate({
        templateId: params[0],
        changes: this.parseChanges(params.slice(1)),
      });
      return customized.code;

    case 'generate':
      const page = await templateManager.generatePage(params[0], params.slice(1));
      return page.code;

    case 'suggest':
      const suggested = await templateManager.suggestTemplates(
        params.join(' ')
      );
      return this.formatSuggestions(suggested);

    default:
      return 'Unknown template command';
  }
}
```

---

## 🎓 Code Generation Recipes

### Recipe 1: E-Commerce Checkout

```typescript
const checkoutPage = await templateManager.generatePage('Checkout', [
  'cart-review',
  'shipping-address',
  'billing-address',
  'payment-method',
  'order-summary',
]);
```

### Recipe 2: Admin Dashboard

```typescript
const dashboard = await templateManager.generatePage('AdminDashboard', [
  'navbar',
  'sidebar',
  'analytics-cards',
  'users-table',
  'revenue-chart',
  'activity-feed',
]);
```

### Recipe 3: User Profile

```typescript
const profile = await templateManager.generatePage('UserProfile', [
  'profile-header',
  'edit-form',
  'settings-panel',
  'activity-history',
  'security-settings',
]);
```

### Recipe 4: Content Management System

```typescript
const cms = await templateManager.generateComponentSuite('ContentHub', {
  needsAuth: true,
  needsDashboard: true,
  needsDataManagement: true,
  needsForms: true,
  theme: 'light',
});
```

---

## 🚀 Deployment Checklist

Before deploying a template-based project:

- [ ] All dependencies installed (`npm install`)
- [ ] TypeScript compiles without errors (`npm run build`)
- [ ] Tests pass (`npm run test`)
- [ ] Components render correctly locally (`npm run dev`)
- [ ] Responsive design tested on mobile/tablet
- [ ] Accessibility check (a11y)
- [ ] Environment variables configured
- [ ] Database migrations run (`npm run migrate`)
- [ ] Performance tested (Lighthouse)
- [ ] Security audit passed (`npm audit`)
- [ ] Deployed to staging first

---

## 🔗 Related Documentation

- [DEVBOT_STACK_GUIDE.md](./DEVBOT_STACK_GUIDE.md) - Tech stack recommendations
- [DEVBOT_FRONTEND_TEMPLATES.md](./DEVBOT_FRONTEND_TEMPLATES.md) - Template code library
- [DEVBOT_FUNCTION_LIBRARY.md](./DEVBOT_FUNCTION_LIBRARY.md) - Complete API reference
- [DEVBOT_SECURITY_GUIDE.md](./DEVBOT_SECURITY_GUIDE.md) - Security best practices

---

## 💡 Pro Tips

1. **Use DevBot for generation** - Don't write boilerplate yourself
2. **Version everything** - Always update templates with changelogs
3. **Test before storing** - Ensure components work before saving
4. **Tag comprehensively** - Makes templates easier to find
5. **Document integrations** - Specify required API keys/services
6. **Cache popular templates** - Improve performance for frequently used components
7. **Backup regularly** - Export templates monthly
8. **Review suggestions** - AI suggestions are 90% accurate but verify

---

**Quick Links:**
- Command Reference: See [DEVBOT_FUNCTION_LIBRARY.md](./DEVBOT_FUNCTION_LIBRARY.md#-devbot-commands)
- API Docs: See [DEVBOT_API_REFERENCE.md](./DEVBOT_API_REFERENCE.md)
- Examples: `/examples` folder
- Support: templates@tolani-labs.io

**Version:** 2.0.0 | **Status:** Production Ready | **Last Updated:** 2026-02-13
