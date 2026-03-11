// src/utils/validators.js

import { z } from "zod";

// Module 1 — Catalog Tag output schema
export const CatalogTagSchema = z.object({
  primary_category: z.string(),
  sub_category: z.string(),
  seo_tags: z.array(z.string()).min(5).max(10),
  sustainability_filters: z.array(z.string()),
  confidence_score: z.number().min(0).max(1).optional(),
});

// Module 2 — B2B Proposal output schema
export const B2BProposalSchema = z.object({
  client_name: z.string(),
  budget_limit: z.number(),
  product_mix: z.array(
    z.object({
      product_id: z.string(),
      name: z.string(),
      quantity: z.number(),
      unit_price: z.number(),
      subtotal: z.number(),
      rationale: z.string(),
    })
  ),
  budget_allocation: z.object({
    personal_care: z.number().optional(),
    kitchen_home: z.number().optional(),
    office_stationery: z.number().optional(),
    gifting: z.number().optional(),
    other: z.number().optional(),
  }),
  cost_breakdown: z.object({
    subtotal: z.number(),
    gst: z.number(),
    shipping: z.number(),
    total: z.number(),
  }),
  impact_positioning: z.string(),
  within_budget: z.boolean(),
});

// Module 3 — Impact Report output schema
export const ImpactReportSchema = z.object({
  order_id: z.string(),
  plastic_saved_grams: z.number(),
  carbon_avoided_kg: z.number(),
  local_sourcing_percentage: z.number().min(0).max(100),
  local_sourcing_summary: z.string(),
  impact_statement: z.string(),
  breakdown: z.array(
    z.object({
      product: z.string(),
      plastic_saved_grams: z.number(),
      carbon_avoided_kg: z.number(),
    })
  ),
});

// Module 4 — WhatsApp intent classification
export const WhatsAppIntentSchema = z.object({
  intent: z.enum(["order_status", "return_policy", "refund_request", "product_query", "escalate", "other"]),
  order_id: z.string().nullable(),
  response: z.string(),
  escalate: z.boolean(),
  escalation_reason: z.string().nullable(),
});

/**
 * Validates data against a Zod schema.
 * Returns { success, data, errors }
 */
export function validate(schema, data) {
  const result = schema.safeParse(data);
  if (result.success) return { success: true, data: result.data };
  return {
    success: false,
    errors: result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
  };
}
