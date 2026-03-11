import { Router } from "express";
import { generateImpactReport, getImpactReport } from "./impact.service.js";

const router = Router();

router.post("/generate/:orderId", async (req, res) => {
  try {
    const result = await generateImpactReport(req.params.orderId);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/:orderId", (req, res) => {
  const report = getImpactReport(req.params.orderId);
  if (!report) return res.status(404).json({ error: "No impact report found for this order" });
  res.json({ success: true, data: report });
});

export default router;