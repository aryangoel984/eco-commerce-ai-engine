import { Router } from "express";
import { generateCatalogTags, bulkGenerateTags, getProductTags } from "./catalog.service.js";
import { getDb } from "../../db/schema.js";

const router = Router();

router.post("/tag", async (req, res) => {
  const { product_id, name, description, price } = req.body;
  if (!product_id || !name || !description) {
    return res.status(400).json({ error: "product_id, name, and description are required" });
  }
  try {
    const result = await generateCatalogTags({ productId: product_id, name, description, price: price ?? 0 });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/bulk-tag", async (_req, res) => {
  try {
    const results = await bulkGenerateTags();
    res.json({ success: true, data: results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/:productId", (req, res) => {
  const tags = getProductTags(req.params.productId);
  if (!tags) return res.status(404).json({ error: "No tags found for this product" });
  res.json({ success: true, data: tags });
});

router.get("/", (_req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT p.*, t.primary_category, t.sub_category, t.seo_tags, t.sustainability_filters
    FROM products p
    LEFT JOIN product_ai_tags t ON t.product_id = p.id
  `).all();
  const data = rows.map((r) => ({
    ...r,
    seo_tags: r.seo_tags ? JSON.parse(r.seo_tags) : null,
    sustainability_filters: r.sustainability_filters ? JSON.parse(r.sustainability_filters) : null,
  }));
  res.json({ success: true, data });
});

export default router;