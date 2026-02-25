/**
 * Integration barrel export
 * All third-party integrations are optional — they guard on their own env vars.
 * Import a namespace:  import * as notion from "@/integrations/notion.js"
 * Or import from here: import { notion, zapier } from "@/integrations/index.js"
 */

export * as notion from "./notion.js";
export * as linear from "./linear.js";
export * as jira from "./jira.js";
export * as pagerduty from "./pagerduty.js";
export * as zapier from "./zapier.js";
export * as clickup from "./clickup.js";
