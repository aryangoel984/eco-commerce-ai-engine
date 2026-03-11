// src/modules/impact/impact.service.js
// Module 3: AI Impact Reporting Generator
//
// ARCHITECTURE NOTE:
// This module uses a hybrid approach:
//   - Business logic pre-computes estimated plastic/carbon values using
//     product-specific lookup tables (no AI needed for math)
//   - AI is used ONLY for generating the human-readable narrative
//
// This is intentional: AI for language, deterministic code for numbers.

import { callAIJson } from "../../utils/ai-client.js";
import { validate, ImpactReportSchema } from "../../utils/validators.js";
import { getDb } from "../../db/schema.js";

// Product-level sustainability impact data (business logic layer)
// plastic_saved_grams: vs. conventional alternative
// carbon_avoided_kg: lifecycle estimate vs. conventional
// is_local: whether sourced within India (affects local sourcing %)
const PRODUCT_IMPACT_DATA = {
  P001: { name: "Bamboo Toothbrush Pack (4)", plastic_saved_grams: 60, carbon_avoided_kg: 0.2, is_local: true },
  P002: { name: "Organic Cotton Tote Bag", plastic_saved_grams: 500, carbon_avoided_kg: 1.8, is_local: true },
  P003: { name: "Compostable Food Wrap (20 sheets)", plastic_saved_grams: 120, carbon_avoided_kg: 0.4, is_local: false },
  P004: { name: "Recycled Steel Water Bottle 750ml", plastic_saved_grams: 800, carbon_avoided_kg: 2.5, is_local: false },
  P005: { name: "Neem Wood Comb", plastic_saved_grams: 25, carbon_avoided_kg: 0.05, is_local: true },
  P006: { name: "Beeswax Candles Set of 3", plastic_saved_grams: 15, carbon_avoided_kg: 0.3, is_local: true },
  P007: { name: "Jute Shopping Bag Large", plastic_saved_grams: 1200, carbon_avoided_kg: 0.9, is_local: true },
  P008: { name: "Recycled Paper Notebook A5", plastic_saved_grams: 10, carbon_avoided_kg: 0.15, is_local: false },
  P009: { name: "Coconut Shell Bowls (2)", plastic_saved_grams: 80, carbon_avoided_kg: 0.1, is_local: true },
  P010: { name: "Activated Charcoal Soap Bar", plastic_saved_grams: 30, carbon_avoided_kg: 0.2, is_local: true },
};

const SYSTEM_PROMPT = `You are an environmental impact analyst for Rayeva, an Indian sustainable commerce platform.

Given an order's sustainability metrics, generate a compelling, factually grounded impact report.

Return ONLY a raw JSON object with this structure:
{
  "order_id": string,
  "plastic_saved_grams": number,
  "carbon_avoided_kg": number,
  "local_sourcing_percentage": number,
  "local_sourcing_summary": string,
  "impact_statement": string,
  "breakdown": [
    {
      "product": string,
      "plastic_saved_grams": number,
      "carbon_avoided_kg": number
    }
  ]
}

Rules for impact_statement:
- 2–3 sentences, human-readable, conversational
- Use relatable analogies (e.g., equivalent to X plastic bottles, X km of car emissions)
- Celebrate the customer's choice authentically
- local_sourcing_summary: mention if artisans or Indian manufacturers are supported
- DO NOT invent numbers — use EXACTLY the numbers provided to you
- Return ONLY raw JSON`;

/**
 * Generate and store an impact report for an order.
 */
export async function generateImpactReport(orderId) {
  const db = getDb();

  // Fetch order — business logic validates order existence
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId);
  if (!order) throw new Error(`Order ${orderId} not found`);

  const items = JSON.parse(order.items);

  // Pre-compute metrics deterministically — no AI involved here
  let totalPlasticSaved = 0;
  let totalCarbonAvoided = 0;
  let localItemCount = 0;
  const breakdown = [];

  for (const item of items) {
    const impact = PRODUCT_IMPACT_DATA[item.id];
    if (!impact) continue;

    const qty = item.qty || 1;
    const plastic = +(impact.plastic_saved_grams * qty).toFixed(2);
    const carbon = +(impact.carbon_avoided_kg * qty).toFixed(3);

    totalPlasticSaved += plastic;
    totalCarbonAvoided += carbon;
    if (impact.is_local) localItemCount += qty;

    breakdown.push({
      product: impact.name,
      plastic_saved_grams: plastic,
      carbon_avoided_kg: carbon,
    });
  }

  const totalItems = items.reduce((acc, i) => acc + (i.qty || 1), 0);
  const localPct = totalItems > 0 ? Math.round((localItemCount / totalItems) * 100) : 0;

  // AI generates the narrative only
  const userPrompt = `Order ID: ${orderId}
Customer: ${order.customer}

Pre-computed metrics (use these exact numbers):
- Total plastic saved: ${totalPlasticSaved}g
- Total carbon avoided: ${totalCarbonAvoided}kg
- Local sourcing: ${localPct}% of items are locally made in India

Per-product breakdown:
${breakdown.map((b) => `- ${b.product}: ${b.plastic_saved_grams}g plastic saved, ${b.carbon_avoided_kg}kg CO2 avoided`).join("\n")}

Generate the impact report JSON using these exact numbers.`;

  // In this implementation, Module 3 is provided as an Architecture Outline only.
  // Instead of calling AI for the narrative, we return a mocked standard response.

  const mockImpactReport = {
    order_id: orderId,
    plastic_saved_grams: totalPlasticSaved,
    carbon_avoided_kg: totalCarbonAvoided,
    local_sourcing_percentage: localPct,
    local_sourcing_summary: `${localPct}% of items in this order support Indian artisans and local manufacturing.`,
    impact_statement: `With this order, you've replaced plastic that would outlast your next 50 birthdays — and kept your carbon footprint lighter than a 20km autorickshaw ride. Two-thirds of your products were made by Indian artisans.`,
    breakdown: breakdown
  };

  // Persist
  const existing = db.prepare("SELECT id FROM impact_reports WHERE order_id = ?").get(orderId);
  if (!existing) {
    db.prepare(`INSERT INTO impact_reports
      (order_id, plastic_saved_grams, carbon_avoided_kg, local_sourcing_pct, impact_statement, raw_response)
      VALUES (?, ?, ?, ?, ?, ?)`).run(
      orderId,
      mockImpactReport.plastic_saved_grams,
      mockImpactReport.carbon_avoided_kg,
      mockImpactReport.local_sourcing_percentage,
      mockImpactReport.impact_statement,
      JSON.stringify(mockImpactReport)
    );
  }

  return mockImpactReport;
}

export function getImpactReport(orderId) {
  const db = getDb();
  return db.prepare("SELECT * FROM impact_reports WHERE order_id = ?").get(orderId);
}
