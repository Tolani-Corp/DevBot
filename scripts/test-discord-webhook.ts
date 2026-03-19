#!/usr/bin/env tsx

/**
 * Test script for Discord webhook integration
 * Run with: pnpm tsx scripts/test-discord-webhook.ts
 */

import {
  sendDiscordAlert,
  sendDiscordDeploymentNotification,
  sendDiscordTestResults,
  sendDiscordPerformanceAlert,
  sendDiscordHealthCheck,
  sendDiscordPipelineStatus,
  sendDiscordErrorAlert,
  sendDiscordActivityUpdate,
  getDiscordWebhookService
} from '../src/services/discord-webhook';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testDiscordWebhook() {
  console.log('🧪 Testing Discord webhook integration...\n');

  const webhookService = getDiscordWebhookService();
  if (!webhookService) {
    console.error('❌ DISCORD_WEBHOOK_URL not configured');
    console.log('Current DISCORD_WEBHOOK_URL:', process.env.DISCORD_WEBHOOK_URL);
    process.exit(1);
  }

  console.log('✅ Discord webhook service initialized');
  console.log('Webhook URL ends with:', process.env.DISCORD_WEBHOOK_URL?.slice(-10));

  // Test 1: Basic alert
  console.log('\n📤 Sending basic alert...');
  const alertSuccess = await sendDiscordAlert('This is a test alert from DevBot! 🚨');
  console.log(alertSuccess ? '✅ Alert sent successfully' : '❌ Alert failed');

  // Test 2: Deployment notification
  console.log('\n📤 Sending deployment notification...');
  const deploySuccess = await sendDiscordDeploymentNotification(
    'Test Deployment',
    'Successfully deployed v2.1.0 to production',
    'success'
  );
  console.log(deploySuccess ? '✅ Deployment notification sent successfully' : '❌ Deployment notification failed');

  // Test 3: Test results
  console.log('\n📤 Sending test results...');
  const testSuccess = await sendDiscordTestResults(
    'Unit Tests',
    {
      passed: 145,
      failed: 3,
      skipped: 2,
      duration: 1250,
      coverage: 87.5
    },
    'partial'
  );
  console.log(testSuccess ? '✅ Test results sent successfully' : '❌ Test results failed');

  // Test 4: Performance alert
  console.log('\n📤 Sending performance alert...');
  const perfSuccess = await sendDiscordPerformanceAlert(
    'Response Time',
    2500,
    2000,
    'ms',
    'warning'
  );
  console.log(perfSuccess ? '✅ Performance alert sent successfully' : '❌ Performance alert failed');

  // Test 5: Health check
  console.log('\n📤 Sending health check...');
  const healthSuccess = await sendDiscordHealthCheck(
    'API Server',
    'healthy',
    {
      responseTime: 145,
      uptime: 99.9,
      errorRate: 0.1,
      lastChecked: new Date()
    }
  );
  console.log(healthSuccess ? '✅ Health check sent successfully' : '❌ Health check failed');

  // Test 6: Pipeline status
  console.log('\n📤 Sending pipeline status...');
  const pipelineSuccess = await sendDiscordPipelineStatus(
    'main-build',
    'main',
    'success',
    {
      commit: 'a1b2c3d4e5f6',
      author: 'john.doe',
      duration: 45000,
      url: 'https://github.com/Tolani-Corp/DevBot/actions/runs/12345'
    }
  );
  console.log(pipelineSuccess ? '✅ Pipeline status sent successfully' : '❌ Pipeline status failed');

  // Test 7: Error alert
  console.log('\n📤 Sending error alert...');
  const errorSuccess = await sendDiscordErrorAlert(
    {
      message: 'Database connection timeout',
      stack: 'Error: connect ETIMEDOUT\n    at Connection._handleTimeout',
      service: 'Database Service',
      userId: 'user_123',
      url: '/api/users/profile'
    },
    'high'
  );
  console.log(errorSuccess ? '✅ Error alert sent successfully' : '❌ Error alert failed');

  // Test 8: Activity update
  console.log('\n📤 Sending activity update...');
  const activitySuccess = await sendDiscordActivityUpdate(
    'New User Registration',
    {
      user: 'alice.smith',
      count: 150,
      milestone: '150th user this month!',
      description: 'Another user has joined the platform'
    }
  );
  console.log(activitySuccess ? '✅ Activity update sent successfully' : '❌ Activity update failed');

  console.log('\n🎉 All Discord webhook tests completed!');
  console.log('Check your Discord channel for all the test notifications.');
}

testDiscordWebhook().catch(console.error);