// src/modules/whatsapp/whatsapp.service.js
// Module 4: AI WhatsApp Support Bot

import { callAIJson } from "../../utils/ai-client.js";
import { validate, WhatsAppIntentSchema } from "../../utils/validators.js";
import { getDb } from "../../db/schema.js";

const RETURN_POLICY = `Rayeva Return Policy:
- Unused, unopened products can be returned within 7 days of delivery
- Items must be in original packaging
- Refunds are processed within 5–7 business days to original payment method
- Non-returnable: perishables, personal care products once opened
- For damaged items: raise a request within 48 hours of delivery with photo evidence
- Contact: support@rayeva.in or WhatsApp this number`;

const SYSTEM_PROMPT = `You are Priya, a warm and helpful customer support agent for Rayeva — India's sustainable commerce marketplace.

You have access to real order data. Always use exact order data provided to you — never invent order statuses.

Your response must be ONLY a raw JSON object:
{
  "intent": one of: "order_status" | "return_policy" | "refund_request" | "product_query" | "escalate" | "other",
  "order_id": string or null,
  "response": string,  // Your WhatsApp reply — conversational, warm, in Hinglish if appropriate
  "escalate": boolean,
  "escalation_reason": string or null
}

Escalate (escalate: true) when:
- Customer mentions refund, damaged product, or complaint
- Customer is angry or uses urgency language (URGENT, asap, immediately)
- Order issue cannot be resolved with available data

Response style:
- Warm, helpful, not robotic
- Brief (2–4 sentences max for WhatsApp)
- Use "Namaste" or "Hello" as greeting
- If escalating, assure customer a human will contact them within 2 hours
- Return ONLY raw JSON`;

/**
 * Processes an inbound WhatsApp message.
 * @param {string} phone - sender's phone number
 * @param {string} message - inbound message text
 */
export async function processWhatsAppMessage(phone, message) {
  const db = getDb();

  // Business logic: look up orders for this phone number
  const customerOrders = db
    .prepare("SELECT * FROM orders WHERE phone = ? OR customer LIKE ? ORDER BY created_at DESC LIMIT 5")
    .all(phone, `%${phone.slice(-4)}%`);

  // Business logic: look up any order ID mentioned in message
  const orderIdMatch = message.match(/ORD-\d{4}-\d{3}/i);
  let specificOrder = null;
  if (orderIdMatch) {
    specificOrder = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderIdMatch[0].toUpperCase());
  }

  const orderContext =
    specificOrder
      ? `Specific order mentioned: ${JSON.stringify(specificOrder)}`
      : customerOrders.length > 0
      ? `Customer's recent orders: ${JSON.stringify(customerOrders)}`
      : "No orders found for this customer.";

  const userPrompt = `Customer Phone: ${phone}
Customer Message: "${message}"

${orderContext}

Return Policy: ${RETURN_POLICY}

Process this message and generate an appropriate response.`;

  // Log inbound message
  db.prepare("INSERT INTO whatsapp_logs (phone, direction, message, intent) VALUES (?, 'inbound', ?, ?)").run(
    phone,
    message,
    "processing"
  );

  const raw = await callAIJson("whatsapp", SYSTEM_PROMPT, userPrompt, 512);

  const { success, data, errors } = validate(WhatsAppIntentSchema, raw);
  if (!success) throw new Error(`WhatsApp AI validation failed: ${errors.join("; ")}`);

  // Log outbound response
  db.prepare(
    "INSERT INTO whatsapp_logs (phone, direction, message, intent, escalated) VALUES (?, 'outbound', ?, ?, ?)"
  ).run(phone, data.response, data.intent, data.escalate ? 1 : 0);

  // If escalation needed — in production, trigger Twilio/Zendesk/Freshdesk webhook here
  if (data.escalate) {
    console.log(`[whatsapp] ESCALATION triggered for ${phone}: ${data.escalation_reason}`);
    await triggerEscalation(phone, message, data.escalation_reason);
  }

  return data;
}

/**
 * Escalation handler — logs and (in production) notifies human agents.
 * Stub for Twilio / CRM webhook integration.
 */
async function triggerEscalation(phone, originalMessage, reason) {
  const db = getDb();
  // In production: POST to Zendesk / Freshdesk / internal Slack webhook
  // For now: flag in DB and log
  db.prepare("UPDATE whatsapp_logs SET escalated = 1 WHERE phone = ? ORDER BY id DESC LIMIT 1").run(phone);
  console.log(`[escalation] Phone: ${phone} | Reason: ${reason} | Message: ${originalMessage}`);
}

/**
 * Get conversation history for a phone number
 */
export function getConversationHistory(phone, limit = 20) {
  const db = getDb();
  return db
    .prepare("SELECT * FROM whatsapp_logs WHERE phone = ? ORDER BY created_at DESC LIMIT ?")
    .all(phone, limit);
}
