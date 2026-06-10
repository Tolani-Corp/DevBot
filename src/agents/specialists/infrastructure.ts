import { generateCodeChanges } from "@/ai/claude.js";
import { tracer } from "@/lib/tracing.js";
import { logger } from "@/lib/logger.js";
import type { AgentTask, AgentResult } from "../types.js";
import { z } from "zod";

/**
 * Infrastructure Agent: Generates and optimizes Infrastructure as Code.
 * 
 * Capabilities:
 * - IaC generation from requirements (Terraform, Bicep, CloudFormation)
 * - Multi-cloud deployment strategies
 * - Cost optimization recommendations
 * - Disaster recovery planning
 * - Auto-scaling configuration
 */

export interface InfrastructureContext {
  requirements: string;
  cloudProvider: "aws" | "azure" | "gcp" | "multi";
  iacFormat: "terraform" | "bicep" | "cloudformation" | "pulumi";
  existingCode?: string;
  budget?: number;
  redundancy?: "none" | "regional" | "multi-region";
}

const InfrastructureContextSchema = z.object({
  requirements: z.string(),
  cloudProvider: z.enum(["aws", "azure", "gcp", "multi"]),
  iacFormat: z.enum(["terraform", "bicep", "cloudformation", "pulumi"]),
  existingCode: z.string().optional(),
  budget: z.number().optional(),
  redundancy: z.enum(["none", "regional", "multi-region"]).optional(),
});

export interface InfrastructureRecommendation {
  category: string;
  description: string;
  estimatedCost: number;
  estimatedMonthlySavings?: number;
  implementation: string;
  priority: "critical" | "high" | "medium" | "low";
}

export async function executeInfrastructureTask(
  task: AgentTask,
  context: InfrastructureContext,
): Promise<AgentResult> {
  const span = tracer.startSpan("infrastructure-agent", {
    attributes: {
      taskId: task.id,
      cloudProvider: context.cloudProvider,
      iacFormat: context.iacFormat,
    },
  });

  try {
    const validContext = InfrastructureContextSchema.parse(context);

    logger.info(`[infra-agent] Generating infrastructure code`, {
      taskId: task.id,
      provider: validContext.cloudProvider,
      format: validContext.iacFormat,
      redundancy: validContext.redundancy,
    });

    const iacCode = await generateInfrastructureCode(validContext);
    const recommendations = await generateRecommendations(validContext);

    const reportContent = `
# Infrastructure as Code Generation

**Provider**: ${validContext.cloudProvider.toUpperCase()}  
**Format**: ${validContext.iacFormat}  
**Redundancy**: ${validContext.redundancy || "none"}

## Generated Code

\`\`\`${validContext.iacFormat}
${iacCode}
\`\`\`

## Recommendations

${recommendations
  .map(
    (r) => `
### ${r.category}
- ${r.description}
- Cost: $${r.estimatedCost}/month
- Priority: ${r.priority}
\`\`\`
${r.implementation}
\`\`\`
`,
  )
  .join("\n")}
`;

    const result: AgentResult = {
      success: true,
      output: iacCode,
      changes: [
        {
          file: `infrastructure.${getFileExtension(validContext.iacFormat)}`,
          content: iacCode,
          explanation: `Generated ${validContext.iacFormat} infrastructure code for ${validContext.cloudProvider}`,
        },
        {
          file: `infrastructure-recommendations.md`,
          content: reportContent,
          explanation: "Infrastructure optimization recommendations and cost analysis",
        },
      ],
    };

    logger.info(`[infra-agent] Infrastructure code generated`, {
      taskId: task.id,
      provider: validContext.cloudProvider,
      recommendations: recommendations.length,
    });

    span.end();
    return result;
  } catch (error) {
    logger.error(`[infra-agent] Task failed`, {
      taskId: task.id,
      error: error instanceof Error ? error.message : String(error),
    });

    span.recordException(error instanceof Error ? error : new Error(String(error)));
    span.end();

    return {
      success: false,
      output: `Infrastructure generation failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Generate Infrastructure as Code
 */
async function generateInfrastructureCode(context: InfrastructureContext): Promise<string> {
  const prompt = `
Generate production-ready Infrastructure as Code (${context.iacFormat}) for ${context.cloudProvider.toUpperCase()}.

Requirements:
${context.requirements}

Specifications:
- Cloud Provider: ${context.cloudProvider}
- Format: ${context.iacFormat}
- Redundancy Level: ${context.redundancy || "standard"}
${context.budget ? `- Budget: $${context.budget}/month` : ""}

Include:
1. Compute resources (servers, containers, functions)
2. Database configuration (backups, replication)
3. Networking (VPC, subnets, security groups, load balancing)
4. Storage (S3/Blob, CDN, backups)
5. Monitoring and logging
6. Auto-scaling policies
7. Disaster recovery configuration
${context.redundancy === "multi-region" ? "8. Multi-region failover setup\n9. Cross-region replication" : ""}

Best practices:
- Infrastructure as Code patterns
- Modular, reusable components
- Environment variables for configuration
- Tagging for cost allocation
- Security hardening
- Cost optimization

${context.existingCode ? `\nExisting infrastructure to extend:\n${context.existingCode}` : ""}

Generate complete, production-ready ${context.iacFormat} code.
`;

  const response = await generateCodeChanges(prompt, {
    filesContents: {},
  });

  return response.plan;
}

/**
 * Generate optimization recommendations
 */
async function generateRecommendations(
  context: InfrastructureContext,
): Promise<InfrastructureRecommendation[]> {
  const prompt = `
Analyze infrastructure requirements and provide cost optimization and architecture recommendations.

Requirements:
${context.requirements}

Provider: ${context.cloudProvider}
Current Budget: ${context.budget || "Not specified"}
Redundancy: ${context.redundancy || "none"}

Provide recommendations for:
1. Cost optimization (reserved instances, spot pricing, auto-scaling)
2. Performance optimization (caching, CDN, regional deployment)
3. Disaster recovery (backups, failover, RTO/RPO targets)
4. Security hardening (encryption, access control, monitoring)
5. Operational excellence (automation, monitoring, alerting)

For each recommendation, provide:
- Category
- Description
- Estimated monthly cost
- Estimated monthly savings
- Implementation details
- Priority level

Format as JSON array of recommendations.
`;

  const response = await generateCodeChanges(prompt, {
    filesContents: {},
  });

  // Try to parse JSON recommendations
  const jsonMatch = response.plan.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      // Fall through
    }
  }

  return [
    {
      category: "Cost Optimization",
      description: response.plan.slice(0, 200),
      estimatedCost: context.budget || 1000,
      priority: "high",
      implementation: "Review reserved instances and auto-scaling policies",
    },
  ];
}

/**
 * Get file extension for infrastructure format
 */
function getFileExtension(format: string): string {
  const extensions: Record<string, string> = {
    terraform: "tf",
    bicep: "bicep",
    cloudformation: "yaml",
    pulumi: "ts",
  };
  return extensions[format] || "txt";
}
