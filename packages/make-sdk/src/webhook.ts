import axios, { AxiosError } from 'axios';
import crypto from 'crypto';
import {
  WebhookConfig,
  WebhookResponse,
  JuniorWebhookPayload,
  MakeToJuniorPayload,
  MakeError,
} from './types';

/**
 * Make.com Webhook Manager
 * Sends webhooks to Make scenarios and validates incoming webhooks
 */
export class MakeWebhook {
  private config: Required<WebhookConfig>;

  constructor(config: WebhookConfig) {
    this.config = {
      timeout: 30000,
      headers: {},
      secret: '',
      ...config,
    };
  }

  /**
   * Send a webhook to Make.com scenario
   */
  async send(payload: JuniorWebhookPayload): Promise<WebhookResponse> {
    try {
      const headers = {
        'Content-Type': 'application/json',
        'X-Webhook-Timestamp': new Date().toISOString(),
        ...this.config.headers,
      };

      // Add signature if secret is configured
      if (this.config.secret) {
        const signature = this.generateSignature(payload);
        headers['X-Webhook-Signature'] = signature;
      }

      const response = await axios.post(this.config.url, payload, {
        headers,
        timeout: this.config.timeout,
      });

      return {
        success: true,
        accepted: response.status === 200 || response.status === 202,
        executionId: response.data?.executionId,
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      const makeError: MakeError = {
        message: axiosError.message,
        statusCode: axiosError.response?.status,
        details: axiosError.response?.data,
      };

      return {
        success: false,
        accepted: false,
        error: makeError,
      };
    }
  }

  /**
   * Send bottleneck detection to Make.com
   */
  async sendBottleneck(data: {
    id: string;
    title: string;
    description?: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    assignedTo?: string;
    metadata?: Record<string, any>;
  }): Promise<WebhookResponse> {
    return this.send({
      event: 'bottleneck_detected',
      timestamp: new Date().toISOString(),
      data,
    });
  }

  /**
   * Send approval request to Make.com
   */
  async sendApprovalRequest(data: {
    id: string;
    title: string;
    description?: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    assignedTo?: string;
    metadata?: Record<string, any>;
  }): Promise<WebhookResponse> {
    return this.send({
      event: 'approval_needed',
      timestamp: new Date().toISOString(),
      data,
    });
  }

  /**
   * Send task escalation to Make.com
   */
  async sendEscalation(data: {
    id: string;
    title: string;
    description?: string;
    priority: 'HIGH' | 'CRITICAL';
    assignedTo: string;
    metadata?: Record<string, any>;
  }): Promise<WebhookResponse> {
    return this.send({
      event: 'task_escalated',
      timestamp: new Date().toISOString(),
      data,
    });
  }

  /**
   * Send SLA breach notification to Make.com
   */
  async sendSLABreach(data: {
    id: string;
    title: string;
    description?: string;
    metadata?: Record<string, any>;
  }): Promise<WebhookResponse> {
    return this.send({
      event: 'sla_breach',
      timestamp: new Date().toISOString(),
      data: {
        ...data,
        priority: 'CRITICAL',
      },
    });
  }

  /**
   * Send crisis mode activation to Make.com
   */
  async sendCrisisMode(data: {
    id: string;
    title: string;
    description?: string;
    metadata?: Record<string, any>;
  }): Promise<WebhookResponse> {
    return this.send({
      event: 'crisis_mode_activated',
      timestamp: new Date().toISOString(),
      data: {
        ...data,
        priority: 'CRITICAL',
      },
    });
  }

  /**
   * Validate incoming webhook from Make.com
   */
  validateWebhook(
    payload: MakeToJuniorPayload,
    signature: string,
    timestamp: string
  ): boolean {
    if (!this.config.secret) {
      // No secret configured, skip validation
      return true;
    }

    // Check timestamp (reject webhooks older than 5 minutes)
    const webhookTime = new Date(timestamp).getTime();
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    if (now - webhookTime > fiveMinutes) {
      return false; // Webhook too old
    }

    // Validate signature
    const expectedSignature = this.generateSignature({ timestamp, ...payload });
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Generate HMAC signature for webhook payload
   */
  private generateSignature(payload: any): string {
    const hmac = crypto.createHmac('sha256', this.config.secret);
    hmac.update(JSON.stringify(payload));
    return hmac.digest('hex');
  }

  /**
   * Parse incoming webhook from Make.com
   */
  parseIncomingWebhook(body: any, headers: Record<string, string>): MakeToJuniorPayload | null {
    try {
      // Validate signature if present
      const signature = headers['x-webhook-signature'];
      const timestamp = headers['x-webhook-timestamp'];

      if (signature && timestamp) {
        const isValid = this.validateWebhook(body, signature, timestamp);
        if (!isValid) {
          throw new Error('Invalid webhook signature');
        }
      }

      return body as MakeToJuniorPayload;
    } catch (error) {
      console.error('Failed to parse incoming webhook:', error);
      return null;
    }
  }
}
