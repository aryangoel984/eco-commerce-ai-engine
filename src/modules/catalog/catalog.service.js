// src/modules/catalog/catalog.service.js
// Module 1: AI Auto-Category & Tag Generator

import { callAIJson } from "../../utils/ai-client.js";
import { validate, CatalogTagSchema } from "../../utils/validators.js";
import { getDb } from "../../db/schema.js";

// Predefined category taxonomy — business logic, NOT AI
const CATEGORIES = {
  "Personal Care": ["Oral Care", "Skin Care", "Hair Care", "Body Care"],
  "Kitchen & Home": ["Food Storage", "Cookware", "Cleaning", "Tableware"],
  "Office & Stationery": ["Notebooks", "Writing", "Organisation"],
  "Fashion & Accessories": ["Bags", "Clothing", "Jewellery"],
  "Gifting & Hampers": ["Corporate Gifts", "Festive", "Wellness"],
  "Food & Beverages": ["Snacks", "Beverages", "Superfoods"],
};

const SUSTAINABILITY_OPTIONS = [
  "plastic-free",
  "compostable",
  "vegan",
  "recycled-material",
  "biodegradable",
  "zero-waste",
  "organic-certified",
  "fair-trade",
  "locally-sourced",
  "upcycled",
  "carbon-neutral",
  "cruelty-free",
];

const SYSTEM_PROMPT = `You are a sustainability-commerce product categorisation engine for Rayeva, an Indian eco-friendly marketplace.

Your job is to analyse product descriptions and return ONLY a valid JSON object (no markdown, no preamble).

Available primary categories: ${Object.keys(CATEGORIES).join(", ")}
Available sub-categories per primary:
${Object.entries(CATEGORIES)
    .map(([k, v]) => `  ${k}: ${v.join(", ")}`)
    .join("\n")}

Available sustainability filters: ${SUSTAINABILITY_OPTIONS.join(", ")}

Rules:
1. primary_category must be EXACTLY one of the listed categories
2. sub_category must be EXACTLY one of the sub-categories for the chosen primary
3. seo_tags: 5–10 strings, mix of product-specific and search-intent keywords (Indian market context)
4. sustainability_filters: choose only applicable ones from the list
5. confidence_score: 0.0–1.0 reflecting how certain you are
6. Return ONLY raw JSON, no backticks, no explanation`;

/**
 * Generates AI tags for a product and persists the result.
 * @param {string} productId
 * @param {string} name
 * @param {string} description
 * @param {number} price
 * @returns {Promise<object>} structured tag output
 */
export async function generateCatalogTags({ productId, name, description, price }) {
  const userPrompt = `Product Name: ${name}
Description: ${description}
Price (INR): ₹${price}

Generate the category, sub-category, SEO tags, and sustainability filters for this product.`;

  const raw = await callAIJson("catalog", SYSTEM_PROMPT, userPrompt, 512);

  // Validate output
  const { success, data, errors } = validate(CatalogTagSchema, raw);
  if (!success) {
    throw new Error(`Catalog AI output validation failed: ${errors.join("; ")}`);
  }

  // Persist to DB (business logic layer)
  const db = getDb();

  // Ensure product exists before tagging to avoid FOREIGN KEY constraints
  db.prepare("INSERT OR IGNORE INTO products (id, name, description, price) VALUES (?, ?, ?, ?)").run(
    productId, name, description, price
  );

  const existing = db.prepare("SELECT id FROM product_ai_tags WHERE product_id = ?").get(productId);

  if (existing) {
    db.prepare(`UPDATE product_ai_tags SET
      primary_category=?, sub_category=?, seo_tags=?, sustainability_filters=?, raw_response=?
      WHERE product_id=?`).run(
      data.primary_category,
      data.sub_category,
      JSON.stringify(data.seo_tags),
      JSON.stringify(data.sustainability_filters),
      JSON.stringify(raw),
      productId
    );
  } else {
    db.prepare(`INSERT INTO product_ai_tags
      (product_id, primary_category, sub_category, seo_tags, sustainability_filters, raw_response)
      VALUES (?, ?, ?, ?, ?, ?)`).run(
      productId,
      data.primary_category,
      data.sub_category,
      JSON.stringify(data.seo_tags),
      JSON.stringify(data.sustainability_filters),
      JSON.stringify(raw)
    );
  }

  return {
    product_id: productId,
    product_name: name,
    ...data,
  };
}

/**
 * Bulk tag generation for all untagged products.
 */
export async function bulkGenerateTags() {
  const db = getDb();
  const untagged = db
    .prepare(`SELECT p.* FROM products p
      LEFT JOIN product_ai_tags t ON t.product_id = p.id
      WHERE t.id IS NULL`)
    .all();

  const results = [];
  for (const product of untagged) {
    try {
      const result = await generateCatalogTags({
        productId: product.id,
        name: product.name,
        description: product.description,
        price: product.price,
      });
      results.push({ success: true, product_id: product.id, result });
    } catch (err) {
      results.push({ success: false, product_id: product.id, error: err.message });
    }
  }
  return results;
}

/**
 * Fetch stored tags for a product
 */
export function getProductTags(productId) {
  const db = getDb();
  const row = db.prepare("SELECT * FROM product_ai_tags WHERE product_id = ?").get(productId);
  if (!row) return null;
  return {
    ...row,
    seo_tags: JSON.parse(row.seo_tags || "[]"),
    sustainability_filters: JSON.parse(row.sustainability_filters || "[]"),
  };
}
