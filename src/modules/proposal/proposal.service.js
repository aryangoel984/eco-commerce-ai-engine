// src/modules/proposal/proposal.service.js
// Module 2: AI B2B Proposal Generator

import { callAIJson } from "../../utils/ai-client.js";
import { validate, B2BProposalSchema } from "../../utils/validators.js";
import { getDb } from "../../db/schema.js";

const SYSTEM_PROMPT = `You are a B2B sustainability procurement advisor for Rayeva, an Indian eco-friendly marketplace.

Your task is to generate structured procurement proposals for corporate clients who want to switch to sustainable products.

You will receive:
- Client profile (company name, team size, use case)
- Budget limit (INR)
- Available product catalogue

Your response must be ONLY a valid raw JSON object with this exact structure:
{
  "client_name": string,
  "budget_limit": number,
  "product_mix": [
    {
      "product_id": string,
      "name": string,
      "quantity": number,
      "unit_price": number,
      "subtotal": number,
      "rationale": string  // Why this product fits the client
    }
  ],
  "budget_allocation": {
    "personal_care": number,     // INR
    "kitchen_home": number,
    "office_stationery": number,
    "gifting": number,
    "other": number
  },
  "cost_breakdown": {
    "subtotal": number,
    "gst": number,              // 18% standard
    "shipping": number,         // Free above ₹999, else ₹99
    "total": number
  },
  "impact_positioning": string,  // 3–4 sentence sustainability narrative for the client's CSR
  "within_budget": boolean
}

Rules:
- Do NOT exceed the budget_limit (including GST and shipping)
- Select 3–6 products with realistic quantities for the team size
- Prefer products with higher sustainability scores
- impact_positioning must mention specific metrics (e.g., plastic pieces eliminated, artisans supported)
- Return ONLY raw JSON, no markdown, no explanation`;

/**
 * Generates a B2B procurement proposal.
 */
export async function generateB2BProposal({ clientName, teamSize, useCase, budgetLimit, preferences }) {
  const db = getDb();

  // Fetch product catalogue — business logic provides grounding data
  const products = db.prepare("SELECT id, name, description, price FROM products").all();

  const catalogue = products
    .map((p) => `- [${p.id}] ${p.name} | ₹${p.price} | ${p.description}`)
    .join("\n");

  const userPrompt = `Client Profile:
- Company: ${clientName}
- Team Size: ${teamSize} employees
- Use Case: ${useCase}
- Budget Limit: ₹${budgetLimit}
- Preferences: ${preferences || "General sustainable products"}

Available Product Catalogue:
${catalogue}

Generate a tailored sustainable procurement proposal within the budget.`;

  // In this implementation, Module 2 is provided as an Architecture Outline only.
  // Instead of calling AI, we return a mocked standard response.

  const mockProposal = {
    client_name: clientName,
    budget_limit: budgetLimit,
    product_mix: [
      {
        product_id: "P001",
        name: "Bamboo Toothbrush Pack (4)",
        quantity: teamSize > 0 ? teamSize : 50,
        unit_price: 299,
        subtotal: 299 * (teamSize > 0 ? teamSize : 50),
        rationale: "High-visibility daily use item — maximises employee touchpoint with brand's sustainability commitment."
      },
      {
        product_id: "P004",
        name: "Recycled Steel Water Bottle 750ml",
        quantity: teamSize > 0 ? Math.floor(teamSize / 2) || 1 : 25,
        unit_price: 799,
        subtotal: 799 * (teamSize > 0 ? Math.floor(teamSize / 2) || 1 : 25),
        rationale: "Premium sustainable gift replacing single-use plastic bottles in the office."
      }
    ],
    budget_allocation: {
      personal_care: 299 * (teamSize > 0 ? teamSize : 50),
      kitchen_home: 799 * (teamSize > 0 ? Math.floor(teamSize / 2) || 1 : 25),
      office_stationery: 0,
      gifting: 0,
      other: 0
    },
    cost_breakdown: {
      subtotal: (299 * (teamSize > 0 ? teamSize : 50)) + (799 * (teamSize > 0 ? Math.floor(teamSize / 2) || 1 : 25)),
      gst: Math.floor(((299 * (teamSize > 0 ? teamSize : 50)) + (799 * (teamSize > 0 ? Math.floor(teamSize / 2) || 1 : 25))) * 0.18),
      shipping: 0,
      total: Math.floor(((299 * (teamSize > 0 ? teamSize : 50)) + (799 * (teamSize > 0 ? Math.floor(teamSize / 2) || 1 : 25))) * 1.18)
    },
    impact_positioning: "This procurement eliminates an estimated 18,000 single-use plastic items annually across your team, reinforcing your CSR commitments.",
    within_budget: true
  };

  // Mock persistence
  const inserted = db.prepare(`INSERT INTO b2b_proposals
    (client_name, budget, product_mix, budget_allocation, cost_breakdown, impact_summary, raw_response)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    mockProposal.client_name,
    mockProposal.budget_limit,
    JSON.stringify(mockProposal.product_mix),
    JSON.stringify(mockProposal.budget_allocation),
    JSON.stringify(mockProposal.cost_breakdown),
    mockProposal.impact_positioning,
    JSON.stringify(mockProposal)
  );

  return { proposal_id: inserted.lastInsertRowid, ...mockProposal };
}

/**
 * Fetch all stored proposals (list view)
 */
export function listProposals() {
  const db = getDb();
  return db.prepare("SELECT id, client_name, budget, impact_summary, created_at FROM b2b_proposals ORDER BY created_at DESC").all();
}

/**
 * Fetch a single proposal by ID
 */
export function getProposal(id) {
  const db = getDb();
  const row = db.prepare("SELECT * FROM b2b_proposals WHERE id = ?").get(id);
  if (!row) return null;
  return {
    ...row,
    product_mix: JSON.parse(row.product_mix),
    budget_allocation: JSON.parse(row.budget_allocation),
    cost_breakdown: JSON.parse(row.cost_breakdown),
  };
}
