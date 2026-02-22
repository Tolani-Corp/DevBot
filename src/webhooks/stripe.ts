/**
 * stripe.ts (webhook handler) — processes Stripe events inbound from the webhook
 *
 * Route: POST /webhooks/stripe  (mounted in src/index.ts)
 *
 * Events handled:
 *   checkout.session.completed        → link customer to workspace, set tier
 *   customer.subscription.updated     → sync tier on plan change
 *   customer.subscription.deleted     → downgrade to free
 *   invoice.payment_succeeded         → reset billing_status to active
 *   invoice.payment_failed            → mark past_due
 *
 * Signature verification uses STRIPE_WEBHOOK_SECRET (whsec_...) — fail-closed.
 *
 * Required env vars:
 *   STRIPE_WEBHOOK_SECRET  — from `stripe listen` or Stripe dashboard webhook config
 *   STRIPE_SECRET_KEY      — for stripe client (loaded in src/services/stripe.ts)
 */

import type { IncomingMessage, ServerResponse } from "http";
import { stripe, findWorkspaceByStripeCustomer, applySubscriptionToWorkspace, downgradeWorkspaceToFree, markWorkspacePastDue } from "@/services/stripe.js";
import { db } from "@/db/index.js";
import { workspaces } from "@/db/schema.js";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";

// ── Main handler ──────────────────────────────────────────────────────────────

export async function handleStripeWebhook(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  // Collect raw body (Stripe requires the raw bytes for signature verification)
  const chunks: Buffer[] = [];
  for await (const chunk of req as AsyncIterable<Buffer>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
  }
  const rawBody = Buffer.concat(chunks);

  // Verify signature
  const sig = req.headers["stripe-signature"] as string | undefined;
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET not set — rejecting all events");
    res.writeHead(500).end("Webhook secret not configured");
    return;
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig ?? "", secret);
  } catch (err) {
    console.warn("[stripe-webhook] Signature verification failed:", (err as Error).message);
    res.writeHead(400).end("Invalid signature");
    return;
  }

  console.log(`[stripe-webhook] Received: ${event.type}`);

  // Dispatch
  try {
    await dispatch(event);
    res.writeHead(200).end(JSON.stringify({ received: true }));
  } catch (err) {
    console.error(`[stripe-webhook] Error processing ${event.type}:`, err);
    // Return 200 to prevent Stripe from retrying (we log internally)
    res.writeHead(200).end(JSON.stringify({ received: true, error: "logged" }));
  }
}

// ── Event dispatcher ──────────────────────────────────────────────────────────

async function dispatch(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
      await onCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      break;

    case "customer.subscription.updated":
      await onSubscriptionUpdated(event.data.object as Stripe.Subscription);
      break;

    case "customer.subscription.deleted":
      await onSubscriptionDeleted(event.data.object as Stripe.Subscription);
      break;

    case "invoice.payment_succeeded":
      await onPaymentSucceeded(event.data.object as Stripe.Invoice);
      break;

    case "invoice.payment_failed":
      await onPaymentFailed(event.data.object as Stripe.Invoice);
      break;

    default:
      console.log(`[stripe-webhook] Unhandled event type: ${event.type}`);
  }
}

// ── Handlers ─────────────────────────────────────────────────────────────────

async function onCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const workspaceId = session.metadata?.workspaceId;
  if (!workspaceId) {
    console.warn("[stripe-webhook] checkout.session.completed missing workspaceId in metadata");
    return;
  }

  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  // Persist Stripe customer ID to workspace
  await db
    .update(workspaces)
    .set({ stripeCustomerId: customerId, updatedAt: new Date() })
    .where(eq(workspaces.id, workspaceId));

  // Fetch full subscription to get price/tier info
  if (subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    await applySubscriptionToWorkspace(workspaceId, subscription);
  }

  console.log(`[stripe-webhook] Checkout complete: workspace=${workspaceId} customer=${customerId}`);
}

async function onSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
  const workspaceId = subscription.metadata?.workspaceId;
  if (!workspaceId) {
    // Fallback: look up by customer ID
    const ws = await findWorkspaceByStripeCustomer(subscription.customer as string);
    if (ws) await applySubscriptionToWorkspace(ws.id, subscription);
    return;
  }
  await applySubscriptionToWorkspace(workspaceId, subscription);
}

async function onSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  const workspaceId = subscription.metadata?.workspaceId;
  if (workspaceId) {
    await downgradeWorkspaceToFree(workspaceId);
    return;
  }
  const ws = await findWorkspaceByStripeCustomer(subscription.customer as string);
  if (ws) await downgradeWorkspaceToFree(ws.id);
}

async function onPaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
  const customerId = invoice.customer as string;
  const ws = await findWorkspaceByStripeCustomer(customerId);
  if (!ws) return;
  await db
    .update(workspaces)
    .set({ billingStatus: "active", updatedAt: new Date() })
    .where(eq(workspaces.id, ws.id));
}

async function onPaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const customerId = invoice.customer as string;
  const ws = await findWorkspaceByStripeCustomer(customerId);
  if (!ws) return;
  await markWorkspacePastDue(ws.id);
}
