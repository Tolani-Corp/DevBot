/**
 * Discord Webhook Service
 * Sends notifications to Discord channels via webhooks
 */

export interface DiscordWebhookMessage {
  content?: string;
  username?: string;
  avatar_url?: string;
  embeds?: DiscordEmbed[];
  tts?: boolean;
}

export interface DiscordEmbed {
  title?: string;
  description?: string;
  url?: string;
  timestamp?: string;
  color?: number;
  footer?: {
    text: string;
    icon_url?: string;
  };
  image?: {
    url: string;
  };
  thumbnail?: {
    url: string;
  };
  author?: {
    name: string;
    url?: string;
    icon_url?: string;
  };
  fields?: {
    name: string;
    value: string;
    inline?: boolean;
  }[];
}

export class DiscordWebhookService {
  private webhookUrl: string;

  constructor(webhookUrl: string) {
    this.webhookUrl = webhookUrl;
  }

  /**
   * Send a message to Discord via webhook
   */
  async sendMessage(message: DiscordWebhookMessage): Promise<boolean> {
    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        console.error(`Discord webhook failed: ${response.status} ${response.statusText}`);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Failed to send Discord webhook:', error);
      return false;
    }
  }

  /**
   * Send a simple text message
   */
  async sendText(content: string, username?: string): Promise<boolean> {
    return this.sendMessage({
      content,
      username,
    });
  }

  /**
   * Send an embed message
   */
  async sendEmbed(embed: DiscordEmbed, username?: string): Promise<boolean> {
    return this.sendMessage({
      username,
      embeds: [embed],
    });
  }

  /**
   * Send a notification about a deployment or build
   */
  async sendDeploymentNotification(
    title: string,
    description: string,
    status: 'success' | 'failure' | 'warning' | 'info',
    fields?: { name: string; value: string; inline?: boolean }[]
  ): Promise<boolean> {
    const colors = {
      success: 0x00ff00,
      failure: 0xff0000,
      warning: 0xffff00,
      info: 0x0099ff,
    };

    const embed: DiscordEmbed = {
      title,
      description,
      color: colors[status],
      timestamp: new Date().toISOString(),
      fields,
    };

    return this.sendEmbed(embed, 'DevBot Deploy');
  }

  /**
   * Send a notification about code changes
   */
  async sendCodeChangeNotification(
    repository: string,
    branch: string,
    commitMessage: string,
    author: string,
    changes: { added: number; modified: number; deleted: number }
  ): Promise<boolean> {
    const embed: DiscordEmbed = {
      title: `🔄 Code Changes in ${repository}`,
      description: `\`\`\`\n${commitMessage}\`\`\``,
      color: 0x0099ff,
      timestamp: new Date().toISOString(),
      fields: [
        {
          name: 'Branch',
          value: branch,
          inline: true,
        },
        {
          name: 'Author',
          value: author,
          inline: true,
        },
        {
          name: 'Changes',
          value: `+${changes.added} 📄 ~${changes.modified} 📝 -${changes.deleted} 🗑️`,
          inline: false,
        },
      ],
    };

    return this.sendEmbed(embed, 'DevBot Git');
  }

  /**
   * Send a security alert
   */
  async sendSecurityAlert(
    title: string,
    description: string,
    severity: 'low' | 'medium' | 'high' | 'critical'
  ): Promise<boolean> {
    const colors = {
      low: 0x00ff00,
      medium: 0xffff00,
      high: 0xffa500,
      critical: 0xff0000,
    };

    const embed: DiscordEmbed = {
      title: `🚨 ${title}`,
      description,
      color: colors[severity],
      timestamp: new Date().toISOString(),
      fields: [
        {
          name: 'Severity',
          value: severity.toUpperCase(),
          inline: true,
        },
      ],
    };

    return this.sendEmbed(embed, 'DevBot Security');
  }

  /**
   * Send a notification about test results
   */
  async sendTestResultsNotification(
    testSuite: string,
    results: {
      passed: number;
      failed: number;
      skipped: number;
      duration: number;
      coverage?: number;
    },
    status: 'passed' | 'failed' | 'partial'
  ): Promise<boolean> {
    const colors = {
      passed: 0x00ff00,
      failed: 0xff0000,
      partial: 0xffff00,
    };

    const total = results.passed + results.failed + results.skipped;
    const passRate = total > 0 ? Math.round((results.passed / total) * 100) : 0;

    const embed: DiscordEmbed = {
      title: `🧪 Test Results: ${testSuite}`,
      description: `**${passRate}%** tests passed (${results.passed}/${total})`,
      color: colors[status],
      timestamp: new Date().toISOString(),
      fields: [
        {
          name: '✅ Passed',
          value: results.passed.toString(),
          inline: true,
        },
        {
          name: '❌ Failed',
          value: results.failed.toString(),
          inline: true,
        },
        {
          name: '⏭️ Skipped',
          value: results.skipped.toString(),
          inline: true,
        },
        {
          name: '⏱️ Duration',
          value: `${results.duration}ms`,
          inline: true,
        },
        ...(results.coverage ? [{
          name: '📊 Coverage',
          value: `${results.coverage}%`,
          inline: true,
        }] : []),
      ],
    };

    return this.sendEmbed(embed, 'DevBot Tests');
  }

  /**
   * Send a notification about performance metrics
   */
  async sendPerformanceNotification(
    metric: string,
    value: number,
    threshold: number,
    unit: string,
    status: 'good' | 'warning' | 'critical'
  ): Promise<boolean> {
    const colors = {
      good: 0x00ff00,
      warning: 0xffff00,
      critical: 0xff0000,
    };

    const statusEmoji = {
      good: '✅',
      warning: '⚠️',
      critical: '🚨',
    };

    const embed: DiscordEmbed = {
      title: `${statusEmoji[status]} Performance Alert: ${metric}`,
      description: `Current value: **${value}${unit}** (threshold: ${threshold}${unit})`,
      color: colors[status],
      timestamp: new Date().toISOString(),
      fields: [
        {
          name: 'Metric',
          value: metric,
          inline: true,
        },
        {
          name: 'Current Value',
          value: `${value}${unit}`,
          inline: true,
        },
        {
          name: 'Threshold',
          value: `${threshold}${unit}`,
          inline: true,
        },
      ],
    };

    return this.sendEmbed(embed, 'DevBot Performance');
  }

  /**
   * Send a notification about system health
   */
  async sendHealthCheckNotification(
    service: string,
    status: 'healthy' | 'degraded' | 'unhealthy',
    details: {
      responseTime?: number;
      uptime?: number;
      errorRate?: number;
      lastChecked: Date;
    }
  ): Promise<boolean> {
    const colors = {
      healthy: 0x00ff00,
      degraded: 0xffff00,
      unhealthy: 0xff0000,
    };

    const statusEmoji = {
      healthy: '🟢',
      degraded: '🟡',
      unhealthy: '🔴',
    };

    const fields = [
      {
        name: 'Status',
        value: `${statusEmoji[status]} ${status.toUpperCase()}`,
        inline: true,
      },
      {
        name: 'Last Checked',
        value: details.lastChecked.toLocaleString(),
        inline: true,
      },
    ];

    if (details.responseTime !== undefined) {
      fields.push({
        name: 'Response Time',
        value: `${details.responseTime}ms`,
        inline: true,
      });
    }

    if (details.uptime !== undefined) {
      fields.push({
        name: 'Uptime',
        value: `${details.uptime}%`,
        inline: true,
      });
    }

    if (details.errorRate !== undefined) {
      fields.push({
        name: 'Error Rate',
        value: `${details.errorRate}%`,
        inline: false,
      });
    }

    const embed: DiscordEmbed = {
      title: `🏥 Health Check: ${service}`,
      description: `Service ${service} is ${status}`,
      color: colors[status],
      timestamp: new Date().toISOString(),
      fields,
    };

    return this.sendEmbed(embed, 'DevBot Health');
  }

  /**
   * Send a notification about CI/CD pipeline status
   */
  async sendPipelineNotification(
    pipeline: string,
    branch: string,
    status: 'success' | 'failure' | 'running' | 'cancelled',
    details: {
      commit?: string;
      author?: string;
      duration?: number;
      url?: string;
    }
  ): Promise<boolean> {
    const colors = {
      success: 0x00ff00,
      failure: 0xff0000,
      running: 0x0099ff,
      cancelled: 0x666666,
    };

    const statusEmoji = {
      success: '✅',
      failure: '❌',
      running: '🔄',
      cancelled: '🚫',
    };

    const fields = [
      {
        name: 'Branch',
        value: branch,
        inline: true,
      },
      {
        name: 'Status',
        value: `${statusEmoji[status]} ${status.toUpperCase()}`,
        inline: true,
      },
    ];

    if (details.author) {
      fields.push({
        name: 'Author',
        value: details.author,
        inline: true,
      });
    }

    if (details.duration) {
      fields.push({
        name: 'Duration',
        value: `${Math.round(details.duration / 1000)}s`,
        inline: true,
      });
    }

    if (details.commit) {
      fields.push({
        name: 'Commit',
        value: details.commit.substring(0, 7),
        inline: true,
      });
    }

    const embed: DiscordEmbed = {
      title: `🔧 Pipeline: ${pipeline}`,
      description: `Pipeline ${pipeline} ${status}`,
      color: colors[status],
      timestamp: new Date().toISOString(),
      url: details.url,
      fields,
    };

    return this.sendEmbed(embed, 'DevBot CI/CD');
  }

  /**
   * Send a notification about error monitoring
   */
  async sendErrorNotification(
    error: {
      message: string;
      stack?: string;
      service: string;
      userId?: string;
      url?: string;
    },
    severity: 'low' | 'medium' | 'high' | 'critical'
  ): Promise<boolean> {
    const colors = {
      low: 0x00ff00,
      medium: 0xffff00,
      high: 0xffa500,
      critical: 0xff0000,
    };

    const severityEmoji = {
      low: 'ℹ️',
      medium: '⚠️',
      high: '🚨',
      critical: '💥',
    };

    const fields = [
      {
        name: 'Service',
        value: error.service,
        inline: true,
      },
      {
        name: 'Severity',
        value: `${severityEmoji[severity]} ${severity.toUpperCase()}`,
        inline: true,
      },
    ];

    if (error.userId) {
      fields.push({
        name: 'User ID',
        value: error.userId,
        inline: true,
      });
    }

    if (error.url) {
      fields.push({
        name: 'URL',
        value: error.url,
        inline: false,
      });
    }

    const embed: DiscordEmbed = {
      title: `${severityEmoji[severity]} Error: ${error.message}`,
      description: error.stack ? `\`\`\`\n${error.stack.substring(0, 1000)}\`\`\`` : 'No stack trace available',
      color: colors[severity],
      timestamp: new Date().toISOString(),
      fields,
    };

    return this.sendEmbed(embed, 'DevBot Errors');
  }

  /**
   * Send a notification about user activity or milestones
   */
  async sendActivityNotification(
    activity: string,
    details: {
      user?: string;
      count?: number;
      milestone?: string;
      description?: string;
    }
  ): Promise<boolean> {
    const embed: DiscordEmbed = {
      title: `📊 Activity: ${activity}`,
      description: details.description || `${activity} activity detected`,
      color: 0x0099ff,
      timestamp: new Date().toISOString(),
      fields: [],
    };

    if (details.user) {
      embed.fields!.push({
        name: 'User',
        value: details.user,
        inline: true,
      });
    }

    if (details.count !== undefined) {
      embed.fields!.push({
        name: 'Count',
        value: details.count.toString(),
        inline: true,
      });
    }

    if (details.milestone) {
      embed.fields!.push({
        name: 'Milestone',
        value: details.milestone,
        inline: true,
      });
    }

    return this.sendEmbed(embed, 'DevBot Activity');
  }
}

// Create a default webhook service instance if DISCORD_WEBHOOK_URL is set
let defaultWebhookService: DiscordWebhookService | null = null;

export function getDiscordWebhookService(): DiscordWebhookService | null {
  if (!defaultWebhookService && process.env.DISCORD_WEBHOOK_URL) {
    defaultWebhookService = new DiscordWebhookService(process.env.DISCORD_WEBHOOK_URL);
  }
  return defaultWebhookService;
}

// Convenience functions for common notifications
export async function sendDiscordAlert(message: string): Promise<boolean> {
  const service = getDiscordWebhookService();
  if (!service) {
    console.warn('DISCORD_WEBHOOK_URL not configured, skipping Discord alert');
    return false;
  }
  return service.sendText(`🚨 **Alert:** ${message}`);
}

export async function sendDiscordDeploymentNotification(
  title: string,
  description: string,
  status: 'success' | 'failure' | 'warning' | 'info'
): Promise<boolean> {
  const service = getDiscordWebhookService();
  if (!service) {
    console.warn('DISCORD_WEBHOOK_URL not configured, skipping Discord notification');
    return false;
  }
  return service.sendDeploymentNotification(title, description, status);
}

export async function sendDiscordTestResults(
  testSuite: string,
  results: {
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
    coverage?: number;
  },
  status: 'passed' | 'failed' | 'partial'
): Promise<boolean> {
  const service = getDiscordWebhookService();
  if (!service) {
    console.warn('DISCORD_WEBHOOK_URL not configured, skipping Discord notification');
    return false;
  }
  return service.sendTestResultsNotification(testSuite, results, status);
}

export async function sendDiscordPerformanceAlert(
  metric: string,
  value: number,
  threshold: number,
  unit: string,
  status: 'good' | 'warning' | 'critical'
): Promise<boolean> {
  const service = getDiscordWebhookService();
  if (!service) {
    console.warn('DISCORD_WEBHOOK_URL not configured, skipping Discord notification');
    return false;
  }
  return service.sendPerformanceNotification(metric, value, threshold, unit, status);
}

export async function sendDiscordHealthCheck(
  service: string,
  status: 'healthy' | 'degraded' | 'unhealthy',
  details: {
    responseTime?: number;
    uptime?: number;
    errorRate?: number;
    lastChecked: Date;
  }
): Promise<boolean> {
  const serviceInstance = getDiscordWebhookService();
  if (!serviceInstance) {
    console.warn('DISCORD_WEBHOOK_URL not configured, skipping Discord notification');
    return false;
  }
  return serviceInstance.sendHealthCheckNotification(service, status, details);
}

export async function sendDiscordPipelineStatus(
  pipeline: string,
  branch: string,
  status: 'success' | 'failure' | 'running' | 'cancelled',
  details: {
    commit?: string;
    author?: string;
    duration?: number;
    url?: string;
  }
): Promise<boolean> {
  const service = getDiscordWebhookService();
  if (!service) {
    console.warn('DISCORD_WEBHOOK_URL not configured, skipping Discord notification');
    return false;
  }
  return service.sendPipelineNotification(pipeline, branch, status, details);
}

export async function sendDiscordErrorAlert(
  error: {
    message: string;
    stack?: string;
    service: string;
    userId?: string;
    url?: string;
  },
  severity: 'low' | 'medium' | 'high' | 'critical'
): Promise<boolean> {
  const service = getDiscordWebhookService();
  if (!service) {
    console.warn('DISCORD_WEBHOOK_URL not configured, skipping Discord notification');
    return false;
  }
  return service.sendErrorNotification(error, severity);
}

export async function sendDiscordActivityUpdate(
  activity: string,
  details: {
    user?: string;
    count?: number;
    milestone?: string;
    description?: string;
  }
): Promise<boolean> {
  const service = getDiscordWebhookService();
  if (!service) {
    console.warn('DISCORD_WEBHOOK_URL not configured, skipping Discord notification');
    return false;
  }
  return service.sendActivityNotification(activity, details);
}