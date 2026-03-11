// src/index.js — Rayeva AI Modules Server

import "dotenv/config";
import express from "express";
import { requestLogger, errorHandler, validateEnv } from "./middleware/index.js";
import { getDb } from "./db/schema.js";
import catalogRoutes from "./modules/catalog/catalog.routes.js";
import proposalRoutes from "./modules/proposal/proposal.routes.js";
import impactRoutes from "./modules/impact/impact.routes.js";
import whatsappRoutes from "./modules/whatsapp/whatsapp.routes.js";

// Validate env at startup
validateEnv();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Twilio sends form-encoded
app.use(requestLogger);

// Initialise DB (creates tables + seeds demo data)
getDb();

// Routes
app.use("/api/catalog", catalogRoutes);
app.use("/api/proposals", proposalRoutes);
app.use("/api/impact", impactRoutes);
app.use("/api/whatsapp", whatsappRoutes);

// Health check
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    modules: ["catalog", "proposals", "impact", "whatsapp"],
    timestamp: new Date().toISOString(),
  });
});

// Admin: view all AI logs
app.get("/api/logs", (_req, res) => {
  const logs = getDb()
    .prepare("SELECT id, module, created_at, tokens_used, duration_ms FROM ai_logs ORDER BY created_at DESC LIMIT 50")
    .all();
  res.json({ success: true, data: logs });
});

// Error handler (must be last)
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║   Rayeva AI Modules — Server Running   ║
╚════════════════════════════════════════╝
  Port    : ${PORT}
  Env     : ${process.env.NODE_ENV || "development"}
  Modules : Catalog | Proposals | Impact | WhatsApp

  Endpoints:
    POST /api/catalog/tag
    POST /api/catalog/bulk-tag
    GET  /api/catalog/:productId
    POST /api/proposals/generate
    GET  /api/proposals
    POST /api/impact/generate/:orderId
    POST /api/whatsapp/test
    POST /api/whatsapp/webhook (Twilio)
    GET  /health
    GET  /api/logs
`);
});

export default app;
