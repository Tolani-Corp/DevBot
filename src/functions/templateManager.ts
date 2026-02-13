// src/functions/templateManager.ts
/**
 * DevBot Template Manager Functions
 * Store, retrieve, and manage frontend component templates
 * 
 * This module integrates with DevBot's memory system to persist
 * component templates and generate code based on stored designs.
 */

import { db } from '@/database';
import { templates, templateVersions } from '@/database/schema';
import { eq, and, like, desc } from 'drizzle-orm';
import { generateCompletion } from '@/ai/claude';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface Component {
  id: string;
  name: string;
  category: 'form' | 'dashboard' | 'table' | 'auth' | 'navigation' | 'card' | 'modal' | 'layout';
  description: string;
  code: string;
  props: Record<string, string>;
  demoData?: Record<string, any>;
  dependencies: string[];
  version: string;
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
}

export interface ComponentVersion {
  id: string;
  componentId: string;
  version: string;
  code: string;
  changelog: string;
  createdAt: Date;
}

export interface CustomizationRequest {
  templateId: string;
  changes: {
    colors?: Record<string, string>;
    layout?: 'horizontal' | 'vertical' | 'grid';
    size?: 'small' | 'medium' | 'large';
    theme?: 'light' | 'dark' | 'auto';
    features?: string[];
    removals?: string[];
  };
}

export interface GenerationRequest {
  templateId: string;
  stackType: 'nextjs' | 'react' | 'vue' | 'python' | 'go' | 'rust';
  customizations?: CustomizationRequest['changes'];
  integrations?: string[];
}

// ============================================================================
// TEMPLATE STORAGE FUNCTIONS
// ============================================================================

/**
 * Store a new component template in memory
 * @param component - Component to store
 * @returns Stored component with ID
 */
export async function storeTemplate(component: Omit<Component, 'id' | 'createdAt'>): Promise<Component> {
  const id = `comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date();

  const storedTemplate = {
    id,
    name: component.name,
    category: component.category,
    description: component.description,
    code: component.code,
    props: JSON.stringify(component.props),
    demoData: component.demoData ? JSON.stringify(component.demoData) : null,
    dependencies: JSON.stringify(component.dependencies),
    version: component.version,
    tags: JSON.stringify(component.tags),
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(templates).values(storedTemplate);

  // Store initial version
  await db.insert(templateVersions).values({
    id: `v_${id}_${component.version}`,
    componentId: id,
    version: component.version,
    code: component.code,
    changelog: 'Initial version',
    createdAt: now,
  });

  return {
    ...component,
    id,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Retrieve a template by ID
 */
export async function getTemplate(id: string): Promise<Component | null> {
  const result = await db.query.templates.findFirst({
    where: eq(templates.id, id),
  });

  if (!result) return null;

  return {
    id: result.id,
    name: result.name,
    category: result.category,
    description: result.description,
    code: result.code,
    props: JSON.parse(result.props),
    demoData: result.demoData ? JSON.parse(result.demoData) : undefined,
    dependencies: JSON.parse(result.dependencies),
    version: result.version,
    tags: JSON.parse(result.tags),
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
  };
}

/**
 * Search templates by category and tags
 */
export async function searchTemplates(
  category?: string,
  tags?: string[],
  query?: string
): Promise<Component[]> {
  let whereConditions = [];

  if (category) {
    whereConditions.push(eq(templates.category, category as any));
  }

  if (query) {
    whereConditions.push(
      like(templates.name, `%${query}%`)
    );
  }

  const where = whereConditions.length > 0 ? and(...whereConditions) : undefined;

  const results = await db.query.templates.findMany({
    where,
    orderBy: desc(templates.createdAt),
  });

  return results
    .filter(r => !tags || tags.some(tag => JSON.parse(r.tags).includes(tag)))
    .map(r => ({
      id: r.id,
      name: r.name,
      category: r.category,
      description: r.description,
      code: r.code,
      props: JSON.parse(r.props),
      demoData: r.demoData ? JSON.parse(r.demoData) : undefined,
      dependencies: JSON.parse(r.dependencies),
      version: r.version,
      tags: JSON.parse(r.tags),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
}

/**
 * List all available templates by category
 */
export async function listTemplatesByCategory(category: string): Promise<Component[]> {
  const results = await db.query.templates.findMany({
    where: eq(templates.category, category as any),
    orderBy: desc(templates.createdAt),
  });

  return results.map(r => ({
    id: r.id,
    name: r.name,
    category: r.category,
    description: r.description,
    code: r.code,
    props: JSON.parse(r.props),
    demoData: r.demoData ? JSON.parse(r.demoData) : undefined,
    dependencies: JSON.parse(r.dependencies),
    version: r.version,
    tags: JSON.parse(r.tags),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

// ============================================================================
// TEMPLATE CUSTOMIZATION FUNCTIONS
// ============================================================================

/**
 * Generate customized version of template
 * Uses Claude to understand changes and apply them intelligently
 */
export async function customizeTemplate(
  request: CustomizationRequest
): Promise<{ code: string; changelog: string }> {
  const template = await getTemplate(request.templateId);
  if (!template) {
    throw new Error(`Template not found: ${request.templateId}`);
  }

  const customizationPrompt = `
    You are a React component expert. Take the following component code and apply these customizations:
    
    Original Component:
    \`\`\`tsx
    ${template.code}
    \`\`\`
    
    Customizations to apply:
    - Colors: ${JSON.stringify(request.changes.colors || {})}
    - Layout: ${request.changes.layout || 'no change'}
    - Size: ${request.changes.size || 'no change'}
    - Theme: ${request.changes.theme || 'no change'}
    - Features to add: ${request.changes.features?.join(', ') || 'none'}
    - Features to remove: ${request.changes.removals?.join(', ') || 'none'}
    
    Return ONLY the modified component code without any explanation.
    Ensure all TypeScript types remain correct.
    Use the same component name and props interface.
  `;

  const customizedCode = await generateCompletion(customizationPrompt, {
    maxTokens: 3000,
  });

  const changelog = [
    request.changes.colors && `Updated colors: ${JSON.stringify(request.changes.colors)}`,
    request.changes.layout && `Changed layout to: ${request.changes.layout}`,
    request.changes.size && `Set size to: ${request.changes.size}`,
    request.changes.theme && `Applied theme: ${request.changes.theme}`,
    request.changes.features && `Added features: ${request.changes.features.join(', ')}`,
    request.changes.removals && `Removed features: ${request.changes.removals.join(', ')}`,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    code: customizedCode,
    changelog,
  };
}

/**
 * Generate code for different tech stack
 * Takes React template and generates Vue/Svelte version if needed
 */
export async function generateForStack(
  request: GenerationRequest
): Promise<{ code: string; framework: string }> {
  const template = await getTemplate(request.templateId);
  if (!template) {
    throw new Error(`Template not found: ${request.templateId}`);
  }

  if (request.stackType === 'react') {
    // No conversion needed
    return { code: template.code, framework: 'React' };
  }

  const conversionPrompt = `
    Convert this React component to ${request.stackType}:
    
    React Component:
    \`\`\`tsx
    ${template.code}
    \`\`\`
    
    ${
      request.customizations
        ? `Apply these customizations: ${JSON.stringify(request.customizations)}`
        : ''
    }
    
    ${
      request.integrations && request.integrations.length > 0
        ? `Include integrations for: ${request.integrations.join(', ')}`
        : ''
    }
    
    Return ONLY the converted code in ${request.stackType}.
    Maintain the same component name and functionality.
    Use appropriate frameworks and libraries for ${request.stackType}.
  `;

  const frameworkNames: Record<string, string> = {
    react: 'React',
    vue: 'Vue 3',
    python: 'Python',
    go: 'Go',
    rust: 'Rust',
  };

  const convertedCode = await generateCompletion(conversionPrompt, {
    maxTokens: 4000,
  });

  return {
    code: convertedCode,
    framework: frameworkNames[request.stackType] || request.stackType,
  };
}

// ============================================================================
// TEMPLATE SUGGESTION FUNCTIONS
// ============================================================================

/**
 * Suggest best templates for a given use case
 */
export async function suggestTemplates(useCase: string): Promise<Component[]> {
  const allTemplates = await db.query.templates.findMany({
    orderBy: desc(templates.createdAt),
  });

  const suggestionPrompt = `
    User wants to build: "${useCase}"
    
    Available templates:
    ${allTemplates.map(t => `- ${t.name} (${t.category}): ${t.description}`).join('\n')}
    
    Which 3-5 templates would best help with this use case?
    Return only the template names, one per line, in order of relevance.
  `;

  const suggestions = await generateCompletion(suggestionPrompt, {
    maxTokens: 500,
  });

  const suggestionNames = suggestions
    .split('\n')
    .map(s => s.trim().replace(/^\d+\.\s*/, ''))
    .filter(Boolean);

  return allTemplates
    .filter(t => suggestionNames.some(name => t.name.toLowerCase().includes(name.toLowerCase())))
    .map(r => ({
      id: r.id,
      name: r.name,
      category: r.category,
      description: r.description,
      code: r.code,
      props: JSON.parse(r.props),
      demoData: r.demoData ? JSON.parse(r.demoData) : undefined,
      dependencies: JSON.parse(r.dependencies),
      version: r.version,
      tags: JSON.parse(r.tags),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
}

/**
 * Generate complete page using multiple templates
 */
export async function generatePage(
  pageName: string,
  components: string[]
): Promise<{ code: string; fileName: string }> {
  const selectedTemplates = await Promise.all(
    components.map(id => getTemplate(id))
  );

  const validTemplates = selectedTemplates.filter(Boolean) as Component[];

  const pagePrompt = `
    Create a complete React page called "${pageName}" using these components:
    
    ${validTemplates.map(t => `- ${t.name}:\n\`\`\`tsx\n${t.code}\n\`\`\``).join('\n\n')}
    
    Create a full page component that:
    1. Imports all components
    2. Arranges them in a logical layout
    3. Handles state and props between components
    4. Includes proper TypeScript types
    5. Uses responsive design
    
    Return only the complete page code.
  `;

  const pageCode = await generateCompletion(pagePrompt, {
    maxTokens: 5000,
  });

  const fileName = pageName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

  return {
    code: pageCode,
    fileName: `${fileName}.tsx`,
  };
}

/**
 * Batch update templates with new version
 */
export async function updateTemplate(
  id: string,
  updates: Partial<Component>,
  changelog: string
): Promise<Component> {
  const template = await getTemplate(id);
  if (!template) {
    throw new Error(`Template not found: ${id}`);
  }

  const newVersion = `${template.version.split('.')[0]}.${parseInt(template.version.split('.')[1] || '0') + 1}`;
  const now = new Date();

  const updateData = {
    name: updates.name || template.name,
    description: updates.description || template.description,
    code: updates.code || template.code,
    props: JSON.stringify(updates.props || template.props),
    demoData: updates.demoData ? JSON.stringify(updates.demoData) : template.demoData,
    dependencies: updates.dependencies ? JSON.stringify(updates.dependencies) : JSON.stringify(template.dependencies),
    tags: updates.tags ? JSON.stringify(updates.tags) : JSON.stringify(template.tags),
    version: newVersion,
    updatedAt: now,
  };

  await db.update(templates).set(updateData).where(eq(templates.id, id));

  // Store version history
  await db.insert(templateVersions).values({
    id: `v_${id}_${newVersion}`,
    componentId: id,
    version: newVersion,
    code: updates.code || template.code,
    changelog,
    createdAt: now,
  } as any);

  return {
    ...template,
    ...updates,
    version: newVersion,
    updatedAt: now,
  };
}

/**
 * Get version history of a template
 */
export async function getTemplateHistory(
  componentId: string
): Promise<ComponentVersion[]> {
  const results = await db.query.templateVersions.findMany({
    where: eq(templateVersions.componentId, componentId),
    orderBy: desc(templateVersions.createdAt),
  });

  return results as ComponentVersion[];
}

// ============================================================================
// BATCH OPERATIONS
// ============================================================================

/**
 * Export all templates as JSON for backup
 */
export async function exportAllTemplates(): Promise<Record<string, Component[]>> {
  const allTemplates = await db.query.templates.findMany();

  const grouped: Record<string, Component[]> = {};

  allTemplates.forEach(t => {
    const category = t.category;
    if (!grouped[category]) grouped[category] = [];

    grouped[category].push({
      id: t.id,
      name: t.name,
      category: t.category,
      description: t.description,
      code: t.code,
      props: JSON.parse(t.props),
      demoData: t.demoData ? JSON.parse(t.demoData) : undefined,
      dependencies: JSON.parse(t.dependencies),
      version: t.version,
      tags: JSON.parse(t.tags),
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    });
  });

  return grouped;
}

/**
 * Get template statistics
 */
export async function getTemplateStats(): Promise<{
  totalTemplates: number;
  byCategory: Record<string, number>;
  lastUpdated: Date | null;
}> {
  const allTemplates = await db.query.templates.findMany();

  const byCategory: Record<string, number> = {};
  let lastUpdated: Date | null = null;

  allTemplates.forEach(t => {
    byCategory[t.category] = (byCategory[t.category] || 0) + 1;
    if (!lastUpdated || t.updatedAt > lastUpdated) {
      lastUpdated = t.updatedAt;
    }
  });

  return {
    totalTemplates: allTemplates.length,
    byCategory,
    lastUpdated,
  };
}

// ============================================================================
// ADVANCED GENERATION
// ============================================================================

/**
 * Generate a full component suite for an application
 */
export async function generateComponentSuite(
  appName: string,
  requirements: {
    needsAuth?: boolean;
    needsDashboard?: boolean;
    needsDataManagement?: boolean;
    needsForms?: boolean;
    theme?: 'light' | 'dark';
    colors?: { primary: string; secondary: string };
  }
): Promise<Map<string, string>> {
  const suite = new Map<string, string>();

  // Get recommended templates
  let query = 'component templates for';
  if (requirements.needsAuth) query += ' authentication and login';
  if (requirements.needsDashboard) query += ' dashboard analytics';
  if (requirements.needsDataManagement) query += ' data tables and management';
  if (requirements.needsForms) query += ' user input forms';

  const suggested = await suggestTemplates(query);

  // Generate components
  for (const template of suggested) {
    const customization: CustomizationRequest = {
      templateId: template.id,
      changes: {
        theme: requirements.theme,
        colors: requirements.colors,
      },
    };

    const customized = await customizeTemplate(customization);
    suite.set(
      `${template.name.toLowerCase().replace(/\s+/g, '-')}.tsx`,
      customized.code
    );
  }

  return suite;
}

export default {
  // Storage
  storeTemplate,
  getTemplate,
  searchTemplates,
  listTemplatesByCategory,
  updateTemplate,
  getTemplateHistory,

  // Customization
  customizeTemplate,
  generateForStack,

  // Suggestions
  suggestTemplates,
  generatePage,
  generateComponentSuite,

  // Utilities
  exportAllTemplates,
  getTemplateStats,
};
