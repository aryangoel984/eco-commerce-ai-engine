// src/utils/ai-client.js
import { default as Groq } from "groq-sdk";
import { getDb } from "../db/schema.js";
import dotenv from "dotenv";

dotenv.config();

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

export async function callAI(module, systemPrompt, userPrompt, maxTokens = 1024) {
  const start = Date.now();

  const response = await client.chat.completions.create({
    model: MODEL,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const duration = Date.now() - start;
  const text = response.choices[0].message.content;
  const tokens = response.usage?.completion_tokens ?? 0;

  try {
    getDb()
      .prepare("INSERT INTO ai_logs (module, prompt, response, tokens_used, duration_ms) VALUES (?, ?, ?, ?, ?)")
      .run(module, userPrompt, text, tokens, duration);
  } catch (_) {
    console.error("[ai-client] Failed to write ai_log:", _);
  }

  return text;
}

export async function callAIJson(module, systemPrompt, userPrompt, maxTokens = 1024) {
  const raw = await callAI(module, systemPrompt, userPrompt, maxTokens);
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`[ai-client] JSON parse failed for module=${module}: ${err.message}\nRaw: ${raw}`);
  }
}