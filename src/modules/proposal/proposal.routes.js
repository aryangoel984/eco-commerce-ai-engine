import { Router } from "express";
import { generateB2BProposal, listProposals, getProposal } from "./proposal.service.js";

const router = Router();

router.post("/generate", async (req, res) => {
  const { client_name, team_size, use_case, budget_limit, preferences } = req.body;
  if (!client_name || !team_size || !budget_limit) {
    return res.status(400).json({ error: "client_name, team_size, and budget_limit are required" });
  }
  if (budget_limit < 500 || budget_limit > 500000) {
    return res.status(400).json({ error: "budget_limit must be between ₹500 and ₹5,00,000" });
  }
  try {
    const result = await generateB2BProposal({
      clientName: client_name,
      teamSize: team_size,
      useCase: use_case || "Corporate sustainability initiative",
      budgetLimit: budget_limit,
      preferences,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/", (_req, res) => {
  try {
    res.json({ success: true, data: listProposals() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/:id", (req, res) => {
  const proposal = getProposal(req.params.id);
  if (!proposal) return res.status(404).json({ error: "Proposal not found" });
  res.json({ success: true, data: proposal });
});

export default router;