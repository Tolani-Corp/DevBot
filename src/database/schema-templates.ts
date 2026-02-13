// src/database/schema-templates.ts
/**
 * Template Storage Schema for DevBot Memory System
 * Handles persistent storage of component templates
 */

import {
  pgTable,
  text,
  varchar,
  timestamp,
  json,
  uuid,
  index,
} from 'drizzle-orm/pg-core';

// ============================================================================
// TEMPLATES TABLE
// ============================================================================

export const templates = pgTable(
  'templates',
  {
    // Core fields
    id: varchar('id', { length: 100 }).primaryKey().notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    category: varchar('category', {
      enum: ['form', 'dashboard', 'table', 'auth', 'navigation', 'card', 'modal', 'layout'],
    }).notNull(),
    description: text('description').notNull(),

    // Code and configuration
    code: text('code').notNull(), // The actual component code
    props: json('props').notNull().default({}), // Component props schema
    demoData: json('demo_data'), // Example data for demo/testing

    // Metadata
    dependencies: json('dependencies').notNull().default([]), // npm packages needed
    version: varchar('version', { length: 20 }).notNull().default('1.0.0'),
    tags: json('tags').notNull().default([]), // Search tags

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => ({
    // Indexes for fast queries
    categoryIdx: index('templates_category_idx').on(table.category),
    nameIdx: index('templates_name_idx').on(table.name),
    versionIdx: index('templates_version_idx').on(table.version),
    createdAtIdx: index('templates_created_at_idx').on(table.createdAt),
  })
);

// ============================================================================
// TEMPLATE VERSIONS TABLE
// ============================================================================

export const templateVersions = pgTable(
  'template_versions',
  {
    // Core fields
    id: varchar('id', { length: 100 }).primaryKey().notNull(),
    componentId: varchar('component_id', { length: 100 })
      .notNull()
      .references(() => templates.id, { onDelete: 'cascade' }),

    // Version info
    version: varchar('version', { length: 20 }).notNull(),
    code: text('code').notNull(),
    changelog: text('changelog'),

    // Timestamp
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => ({
    // Indexes
    componentIdIdx: index('versions_component_id_idx').on(table.componentId),
    versionIdx: index('versions_version_idx').on(table.version),
  })
);

// ============================================================================
// TEMPLATE CUSTOMIZATIONS TABLE
// ============================================================================

export const templateCustomizations = pgTable(
  'template_customizations',
  {
    // Core fields
    id: varchar('id', { length: 100 }).primaryKey().notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    baseTemplateId: varchar('base_template_id', { length: 100 })
      .notNull()
      .references(() => templates.id, { onDelete: 'cascade' }),

    // Customization details
    code: text('code').notNull(),
    description: text('description'),
    customizations: json('customizations').notNull(), // Applied changes

    // Metadata
    author: varchar('author', { length: 255 }),
    isPublic: boolean('is_public').notNull().default(false),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => ({
    baseTemplateIdx: index('customizations_base_idx').on(table.baseTemplateId),
    authorIdx: index('customizations_author_idx').on(table.author),
  })
);

// ============================================================================
// TEMPLATE USAGE TABLE
// ============================================================================

export const templateUsage = pgTable(
  'template_usage',
  {
    // Core fields
    id: varchar('id', { length: 100 }).primaryKey().notNull(),
    templateId: varchar('template_id', { length: 100 })
      .notNull()
      .references(() => templates.id, { onDelete: 'cascade' }),

    // Usage context
    usageContext: varchar('usage_context', { length: 255 }),
    projectId: varchar('project_id', { length: 100 }),
    userId: varchar('user_id', { length: 100 }),

    // Metrics
    usageCount: integer('usage_count').notNull().default(1),
    successfulBuilds: integer('successful_builds').notNull().default(1),
    failedBuilds: integer('failed_builds').notNull().default(0),
    rating: integer('rating'), // 1-5 star rating

    // Timestamp
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => ({
    templateIdIdx: index('usage_template_id_idx').on(table.templateId),
    projectIdIdx: index('usage_project_id_idx').on(table.projectId),
  })
);

// ============================================================================
// TEMPLATE COLLECTIONS TABLE
// ============================================================================

export const templateCollections = pgTable(
  'template_collections',
  {
    // Core fields
    id: varchar('id', { length: 100 }).primaryKey().notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),

    // Collection type
    type: varchar('type', {
      enum: ['built-in', 'custom', 'community'],
    }).notNull().default('custom'),

    // Content
    vectorData: text('vector_data'), // For semantic search
    templates: json('templates').notNull().default([]), // Array of template IDs

    // Metadata
    isPublic: boolean('is_public').notNull().default(false),
    category: varchar('category', { length: 100 }),
    tags: json('tags').notNull().default([]),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => ({
    typeIdx: index('collections_type_idx').on(table.type),
    categoryIdx: index('collections_category_idx').on(table.category),
  })
);

// ============================================================================
// INTEGRATION TABLE
// ============================================================================

export const templateIntegrations = pgTable(
  'template_integrations',
  {
    // Core fields
    id: varchar('id', { length: 100 }).primaryKey().notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    templateId: varchar('template_id', { length: 100 })
      .notNull()
      .references(() => templates.id, { onDelete: 'cascade' }),

    // Integration details
    integrationType: varchar('integration_type', {
      enum: ['api', 'database', 'auth', 'payment', 'messaging', 'analytics', 'ai', 'custom'],
    }).notNull(),

    // Configuration
    configuration: json('configuration').notNull(), // Integration config
    code: text('code'), // Integration code snippet
    documentation: text('documentation'),

    // Metadata
    isActive: boolean('is_active').notNull().default(true),
    version: varchar('version', { length: 20 }).notNull().default('1.0.0'),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => ({
    templateIdIdx: index('integrations_template_id_idx').on(table.templateId),
    typeIdx: index('integrations_type_idx').on(table.integrationType),
  })
);

// ============================================================================
// SQL SCHEMA EXPORT
// ============================================================================

/**
 * SQL Schema for PostgreSQL
 * Copy and run this to create the tables
 */
export const createTemplateSchema = `
-- Templates Table
CREATE TABLE IF NOT EXISTS templates (
  id VARCHAR(100) PRIMARY KEY NOT NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('form', 'dashboard', 'table', 'auth', 'navigation', 'card', 'modal', 'layout')),
  description TEXT NOT NULL,
  code TEXT NOT NULL,
  props JSONB NOT NULL DEFAULT '{}',
  demo_data JSONB,
  dependencies JSONB NOT NULL DEFAULT '[]',
  version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
  tags JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX templates_category_idx ON templates(category);
CREATE INDEX templates_name_idx ON templates(name);
CREATE INDEX templates_version_idx ON templates(version);
CREATE INDEX templates_created_at_idx ON templates(created_at);

-- Template Versions Table
CREATE TABLE IF NOT EXISTS template_versions (
  id VARCHAR(100) PRIMARY KEY NOT NULL,
  component_id VARCHAR(100) NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  version VARCHAR(20) NOT NULL,
  code TEXT NOT NULL,
  changelog TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX versions_component_id_idx ON template_versions(component_id);
CREATE INDEX versions_version_idx ON template_versions(version);

-- Template Customizations Table
CREATE TABLE IF NOT EXISTS template_customizations (
  id VARCHAR(100) PRIMARY KEY NOT NULL,
  name VARCHAR(255) NOT NULL,
  base_template_id VARCHAR(100) NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  description TEXT,
  customizations JSONB NOT NULL,
  author VARCHAR(255),
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX customizations_base_idx ON template_customizations(base_template_id);
CREATE INDEX customizations_author_idx ON template_customizations(author);

-- Template Usage Table
CREATE TABLE IF NOT EXISTS template_usage (
  id VARCHAR(100) PRIMARY KEY NOT NULL,
  template_id VARCHAR(100) NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  usage_context VARCHAR(255),
  project_id VARCHAR(100),
  user_id VARCHAR(100),
  usage_count INTEGER NOT NULL DEFAULT 1,
  successful_builds INTEGER NOT NULL DEFAULT 1,
  failed_builds INTEGER NOT NULL DEFAULT 0,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  last_used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX usage_template_id_idx ON template_usage(template_id);
CREATE INDEX usage_project_id_idx ON template_usage(project_id);

-- Template Collections Table
CREATE TABLE IF NOT EXISTS template_collections (
  id VARCHAR(100) PRIMARY KEY NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL DEFAULT 'custom' CHECK (type IN ('built-in', 'custom', 'community')),
  vector_data TEXT,
  templates JSONB NOT NULL DEFAULT '[]',
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  category VARCHAR(100),
  tags JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX collections_type_idx ON template_collections(type);
CREATE INDEX collections_category_idx ON template_collections(category);

-- Template Integrations Table
CREATE TABLE IF NOT EXISTS template_integrations (
  id VARCHAR(100) PRIMARY KEY NOT NULL,
  name VARCHAR(255) NOT NULL,
  template_id VARCHAR(100) NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  integration_type VARCHAR(50) NOT NULL CHECK (integration_type IN ('api', 'database', 'auth', 'payment', 'messaging', 'analytics', 'ai', 'custom')),
  configuration JSONB NOT NULL,
  code TEXT,
  documentation TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX integrations_template_id_idx ON template_integrations(template_id);
CREATE INDEX integrations_type_idx ON template_integrations(integration_type);

-- Seed with built-in templates (optional)
INSERT INTO templates (id, name, category, description, code, version, tags, created_at, updated_at)
VALUES
  (
    'tmpl_contact_form_001',
    'Contact Form',
    'form',
    'Professional contact form with validation and error handling',
    '// Contact form component code here',
    '1.0.0',
    '[\"contact\", \"form\", \"validation\"]',
    NOW(),
    NOW()
  ),
  (
    'tmpl_dashboard_001',
    'Analytics Dashboard',
    'dashboard',
    'Complete analytics dashboard with charts and metrics',
    '// Dashboard component code here',
    '1.0.0',
    '[\"analytics\", \"dashboard\", \"metrics\"]',
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO NOTHING;
`;

export default {
  templates,
  templateVersions,
  templateCustomizations,
  templateUsage,
  templateCollections,
  templateIntegrations,
};
