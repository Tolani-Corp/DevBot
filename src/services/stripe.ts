/**
 * stripe.ts — Stripe billing client + tier mapping
 *
 * Centralises all Stripe SDK usage. All webhook and checkout logic
 * calls through this file rather than instantiating Stripe inline.
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY             — sk_live_... or sk_test_...
 *   STRIPE_PRICE_PRO_MONTHLY      — Stripe price ID for the Pro plan
 *   STRIPE_PRICE_TEAM_MONTHLY     — Stripe price ID for the Team plan
 *   STRIPE_PRICE_ENTERPRISE_MONTHLY — Stripe price ID for the Enterprise plan
 *   STRIPE_WEBHOOK_SECRET         — whsec_... from stripe listen or dashboard
 */

import Stripe from "stripe";
import { db } from "@/db/index.js";
import { workspaces } from "@/db/schema.js";
import { eq } from "drizzle-orm";
import type { TierName } from "@/services/tier-manager.js";

// ── Stripe client ─────────────────────────────────────────────────────────────

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2025-01-27.acacia",
  typescript: true,
});

// ── Price ID → tier mapping ───────────────────────────────────────────────────

export const PRICE_TO_TIER: Record<string, TierName> = {
  [process.env.STRIPE_PRICE_PRO_MONTHLY ?? "__pro__"]: "pro",
  [process.env.STRIPE_PRICE_TEAM_MONTHLY ?? "__team__"]: "team",
  [process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY ?? "__enterprise__"]: "enterprise",
};

export function tierFromPriceId(priceId: string | null | undefined): TierName {
  if (!priceId) return "free";
  return PRICE_TO_TIER[priceId] ?? "free";
}

// ── Checkout ──────────────────────────────────────────────────────────────────

export interface CreateCheckoutOptions {
  workspaceId: string;
  tier: Exclude<TierName, "free">;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
}

export async function createCheckoutSession(
  opts: CreateCheckoutOptions
): Promise<Stripe.Checkout.Session> {
  const priceIdMap: Record<Exclude<TierName, "free">, string | undefined> = {
    pro: process.env.STRIPE_PRICE_PRO_MONTHLY,
    team: process.env.STRIPE_PRICE_TEAM_MONTHLY,
    enterprise: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY,
  };

  const priceId = priceIdMap[opts.tier];
  if (!priceId) throw new Error(`No price ID configured for tier: ${opts.tier}`);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    customer_email: opts.customerEmail,
    metadata: { workspaceId: opts.workspaceId, tier: opts.tier },
    subscription_data: {
      metadata: { workspaceId: opts.workspaceId, tier: opts.tier },
    },
  });

  return session;
}

// ── Customer portal ───────────────────────────────────────────────────────────

export async function createPortalSession(
  customerId: string,
  returnUrl: string
): Promise<Stripe.BillingPortal.Session> {
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}

// ── DB helpers ────────────────────────────────────────────────────────────────

export async function findWorkspaceByStripeCustomer(
  customerId: string
): Promise<{ id: string; tier: string } | null> {
  const [ws] = await db
    .select({ id: workspaces.id, tier: workspaces.tier })
    .from(workspaces)
    .where(eq(workspaces.stripeCustomerId, customerId));
  return ws ?? null;
}

export async function applySubscriptionToWorkspace(
  workspaceId: string,
  subscription: Stripe.Subscription
): Promise<void> {
  const priceId = subscription.items.data[0]?.price?.id ?? null;
  const tier = tierFromPriceId(priceId);
  const periodEnd = new Date((subscription.current_period_end ?? 0) * 1000);

  await db
    .update(workspaces)
    .set({
      tier,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      billingStatus: subscription.status as "active" | "past_due" | "canceled" | "trialing",
      currentPeriodEnd: periodEnd,
      updatedAt: new Date(),
    })
    .where(eq(workspaces.id, workspaceId));

  console.log(`[stripe] Workspace ${workspaceId} → tier: ${tier} (${subscription.status})`);
}

export async function downgradeWorkspaceToFree(workspaceId: string): Promise<void> {
  await db
    .update(workspaces)
    .set({
      tier: "free",
      stripeSubscriptionId: null,
      stripePriceId: null,
      billingStatus: "canceled",
      currentPeriodEnd: null,
      updatedAt: new Date(),
    })
    .where(eq(workspaces.id, workspaceId));

  console.log(`[stripe] Workspace ${workspaceId} downgraded to free`);
}

export async function markWorkspacePastDue(workspaceId: string): Promise<void> {
  await db
    .update(workspaces)
    .set({ billingStatus: "past_due", updatedAt: new Date() })
    .where(eq(workspaces.id, workspaceId));

  console.log(`[stripe] Workspace ${workspaceId} marked past_due`);
}
