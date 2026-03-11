import { Router } from "express";
import { processWhatsAppMessage, getConversationHistory } from "./whatsapp.service.js";
import { getDb } from "../../db/schema.js";

const router = Router();

router.post("/webhook", async (req, res) => {
  const phone = req.body.From || req.body.phone;
  const message = req.body.Body || req.body.message;
  if (!phone || !message) {
    return res.status(400).json({ error: "phone and message are required" });
  }
  try {
    const result = await processWhatsAppMessage(phone, message);
    res.set("Content-Type", "text/xml");
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${String(result.response).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</Message>
</Response>`);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/test", async (req, res) => {
  const { phone, message } = req.body;
  if (!phone || !message) {
    return res.status(400).json({ error: "phone and message are required" });
  }
  try {
    const result = await processWhatsAppMessage(phone, message);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/history/:phone", (req, res) => {
  const history = getConversationHistory(decodeURIComponent(req.params.phone));
  res.json({ success: true, data: history });
});

router.get("/logs", (_req, res) => {
  const db = getDb();
  const logs = db.prepare("SELECT * FROM whatsapp_logs ORDER BY created_at DESC LIMIT 100").all();
  res.json({ success: true, data: logs });
});

export default router;