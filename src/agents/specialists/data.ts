import { generateCodeChanges } from "@/ai/claude.js";
import { analyzeFiles } from "@/ai/rag.js";
import { tracer } from "@/lib/tracing.js";
import { logger } from "@/lib/logger.js";
import type { AgentTask, AgentResult } from "../types.js";
import { z } from "zod";

/**
 * Data Agent: Handles data pipelines, ETL, and analytics optimization.
 * 
 * Capabilities:
 * - SQL query optimization
 * - Data pipeline generation
 * - ETL validation
 * - Analytics schema design
 * - Data quality checks
 */

export interface DataContext {
  files: Record<string, string>;
  taskType: "pipeline" | "etl" | "schema" | "query" | "quality";
  dataSource?: string;
  targetSchema?: string;
  volumeEstimate?: number;
}

const DataContextSchema = z.object({
  files: z.record(z.string()),
  taskType: z.enum(["pipeline", "etl", "schema", "query", "quality"]),
  dataSource: z.string().optional(),
  targetSchema: z.string().optional(),
  volumeEstimate: z.number().optional(),
});

export interface DataRecommendation {
  issue: string;
  description: string;
  impact: string;
  suggestedFix: string;
  effort: "low" | "medium" | "high";
}

export async function executeDataTask(
  task: AgentTask,
  context: DataContext,
): Promise<AgentResult> {
  const span = tracer.startSpan("data-agent", {
    attributes: {
      taskId: task.id,
      taskType: context.taskType,
    },
  });

  try {
    const validContext = DataContextSchema.parse(context);

    logger.info(`[data-agent] Processing ${validContext.taskType} task`, {
      taskId: task.id,
      taskType: validContext.taskType,
      volumeEstimate: validContext.volumeEstimate,
    });

    let generatedCode: string;
    let recommendations: DataRecommendation[] = [];

    switch (validContext.taskType) {
      case "pipeline":
        generatedCode = await generateDataPipeline(validContext);
        recommendations = await analyzePipelineOptimizations(validContext);
        break;
      case "etl":
        generatedCode = await generateETL(validContext);
        recommendations = await analyzeETLValidation(validContext);
        break;
      case "schema":
        generatedCode = await generateSchema(validContext);
        recommendations = await analyzeSchemaOptimizations(validContext);
        break;
      case "query":
        generatedCode = await optimizeQueries(validContext);
        recommendations = await analyzeQueryPerformance(validContext);
        break;
      case "quality":
        generatedCode = await generateQualityChecks(validContext);
        recommendations = await analyzeDataQuality(validContext);
        break;
    }

    const report = generateDataReport(validContext.taskType, generatedCode, recommendations);

    const result: AgentResult = {
      success: true,
      output: generatedCode,
      changes: [
        {
          file: `data-${validContext.taskType}.ts`,
          content: generatedCode,
          explanation: `Generated data ${validContext.taskType} code`,
        },
        {
          file: `data-${validContext.taskType}-analysis.md`,
          content: report,
          explanation: "Data analysis and optimization recommendations",
        },
      ],
    };

    logger.info(`[data-agent] Task completed`, {
      taskId: task.id,
      taskType: validContext.taskType,
      recommendations: recommendations.length,
    });

    span.end();
    return result;
  } catch (error) {
    logger.error(`[data-agent] Task failed`, {
      taskId: task.id,
      error: error instanceof Error ? error.message : String(error),
    });

    span.recordException(error instanceof Error ? error : new Error(String(error)));
    span.end();

    return {
      success: false,
      output: `Data task failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Generate data pipeline code
 */
async function generateDataPipeline(context: DataContext): Promise<string> {
  const prompt = `
Generate a data pipeline using Node.js and database tools.

Source: ${context.dataSource || "multiple sources"}
Target Schema: ${context.targetSchema || "not specified"}
Estimated Volume: ${context.volumeEstimate || "unknown"} records/sec

Requirements:
1. Extract data from sources
2. Transform and enrich
3. Load into data warehouse
4. Error handling and retry logic
5. Progress tracking
6. Resource cleanup

Include:
- Connection pooling
- Batch processing
- Transaction management
- Logging and monitoring
- Graceful shutdown

Source code context:
${Object.entries(context.files)
  .slice(0, 3)
  .map(([path, content]) => `## ${path}\n\`\`\`ts\n${content.slice(0, 300)}\n\`\`\``)
  .join("\n\n")}

Generate production-ready TypeScript data pipeline code.
`;

  const code = await generateCodeChanges(prompt, {
    filesContents: context.files,
  });

  return code.plan;
}

/**
 * Generate ETL code
 */
async function generateETL(context: DataContext): Promise<string> {
  const prompt = `
Generate ETL (Extract, Transform, Load) code.

Source: ${context.dataSource}
Target: ${context.targetSchema}

Include:
1. Extract logic from various sources (CSV, API, database)
2. Data validation and cleansing
3. Transformation rules and mappings
4. Deduplication
5. Data quality gates
6. Load with conflict resolution
7. Audit trail logging

Generate TypeScript code with:
- Error handling
- Partial failure recovery
- Progress reporting
- Unit tests

Source context:
${Object.entries(context.files)
  .map(([path, content]) => `## ${path}\n\`\`\`ts\n${content.slice(0, 300)}\n\`\`\``)
  .join("\n\n")}
`;

  const code = await generateCodeChanges(prompt, {
    filesContents: context.files,
  });

  return code.plan;
}

/**
 * Generate database schema
 */
async function generateSchema(context: DataContext): Promise<string> {
  const prompt = `
Design an optimal analytics database schema.

Target: ${context.targetSchema}
Volume Estimate: ${context.volumeEstimate || "unknown"} records

Schema should include:
1. Fact tables (transactional data)
2. Dimension tables (reference data)
3. Intermediate tables (aggregations)
4. Indexes for common queries
5. Partitioning strategy
6. Retention policies

Generate:
- SQL DDL statements
- Index definitions
- Partitioning strategy
- Maintenance scripts
- Monitoring queries

Optimize for:
- Query performance
- Storage efficiency
- Data freshness
- Cost

Source context:
${Object.entries(context.files)
  .map(([path, content]) => `## ${path}\n\`\`\`ts\n${content.slice(0, 300)}\n\`\`\``)
  .join("\n\n")}
`;

  const code = await generateCodeChanges(prompt, {
    filesContents: context.files,
  });

  return code.plan;
}

/**
 * Optimize existing queries
 */
async function optimizeQueries(context: DataContext): Promise<string> {
  const prompt = `
Analyze and optimize SQL queries.

Source files:
${Object.entries(context.files)
  .map(([path, content]) => `## ${path}\n\`\`\`sql\n${content}\n\`\`\``)
  .join("\n\n")}

For each query, provide:
1. Execution plan analysis
2. Missing indexes
3. Rewrite with better performance
4. Expected improvement percentage
5. Trade-offs (storage vs. speed)

Generate optimized queries with explanations.
`;

  const code = await generateCodeChanges(prompt, {
    filesContents: context.files,
  });

  return code.plan;
}

/**
 * Generate data quality checks
 */
async function generateQualityChecks(context: DataContext): Promise<string> {
  const prompt = `
Generate comprehensive data quality checks.

Target Schema: ${context.targetSchema}

Checks should verify:
1. Referential integrity
2. Not-null constraints
3. Data type validation
4. Range/domain validation
5. Duplicate detection
6. Freshness checks (last update time)
7. Completeness metrics
8. Anomaly detection

Generate:
- SQL queries for each check
- Alert thresholds
- Reporting scripts
- Remediation suggestions

Source context:
${Object.entries(context.files)
  .map(([path, content]) => `## ${path}\n\`\`\`ts\n${content.slice(0, 300)}\n\`\`\``)
  .join("\n\n")}
`;

  const code = await generateCodeChanges(prompt, {
    filesContents: context.files,
  });

  return code.plan;
}

/**
 * Placeholder functions for analysis
 */
async function analyzePipelineOptimizations(
  context: DataContext,
): Promise<DataRecommendation[]> {
  return [
    {
      issue: "Add connection pooling",
      description: "Multiple connections will cause resource exhaustion",
      impact: "Prevent production outages",
      suggestedFix: "Implement connection pool with max 50 connections",
      effort: "low",
    },
  ];
}

async function analyzeETLValidation(context: DataContext): Promise<DataRecommendation[]> {
  return [
    {
      issue: "Add idempotency keys",
      description: "Retries could cause duplicates",
      impact: "Data integrity issues",
      suggestedFix: "Add unique constraint on source_id",
      effort: "medium",
    },
  ];
}

async function analyzeSchemaOptimizations(context: DataContext): Promise<DataRecommendation[]> {
  return [
    {
      issue: "Add appropriate indexes",
      description: "Common queries will be slow without indexes",
      impact: "Query performance",
      suggestedFix: "Add indexes on foreign keys and time columns",
      effort: "low",
    },
  ];
}

async function analyzeQueryPerformance(context: DataContext): Promise<DataRecommendation[]> {
  return [];
}

async function analyzeDataQuality(context: DataContext): Promise<DataRecommendation[]> {
  return [];
}

/**
 * Generate analysis report
 */
function generateDataReport(
  taskType: string,
  code: string,
  recommendations: DataRecommendation[],
): string {
  return `
# Data ${taskType.toUpperCase()} Analysis

## Generated Code

\`\`\`ts
${code.slice(0, 1000)}
\`\`\`

## Recommendations

${recommendations
  .map(
    (r) => `
### ${r.issue}
- **Description**: ${r.description}
- **Impact**: ${r.impact}
- **Effort**: ${r.effort}
- **Fix**: ${r.suggestedFix}
`,
  )
  .join("\n")}
`;
}
