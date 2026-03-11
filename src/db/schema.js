// src/db/schema.js
// Initialises the SQLite database with all required tables

import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "../../rayeva.db");

let db;

export function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initSchema(db);
  }
  return db;
}

function initSchema(db) {
  db.exec(`
    -- Products table
    CREATE TABLE IF NOT EXISTS products (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      description TEXT,
      price       REAL,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    -- AI Catalog Tags — Module 1 output
    CREATE TABLE IF NOT EXISTS product_ai_tags (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id      TEXT NOT NULL REFERENCES products(id),
      primary_category TEXT,
      sub_category    TEXT,
      seo_tags        TEXT,   -- JSON array
      sustainability_filters TEXT, -- JSON array
      raw_response    TEXT,
      created_at      TEXT DEFAULT (datetime('now'))
    );

    -- B2B Proposals — Module 2 output
    CREATE TABLE IF NOT EXISTS b2b_proposals (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      client_name     TEXT,
      budget          REAL,
      product_mix     TEXT,   -- JSON
      budget_allocation TEXT, -- JSON
      cost_breakdown  TEXT,   -- JSON
      impact_summary  TEXT,
      raw_response    TEXT,
      created_at      TEXT DEFAULT (datetime('now'))
    );

    -- Orders table (used by Modules 3 & 4)
    CREATE TABLE IF NOT EXISTS orders (
      id          TEXT PRIMARY KEY,
      customer    TEXT,
      phone       TEXT,
      items       TEXT,       -- JSON array
      total       REAL,
      status      TEXT DEFAULT 'processing',
      created_at  TEXT DEFAULT (datetime('now'))
    );

    -- Impact Reports — Module 3 output
    CREATE TABLE IF NOT EXISTS impact_reports (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id            TEXT REFERENCES orders(id),
      plastic_saved_grams REAL,
      carbon_avoided_kg   REAL,
      local_sourcing_pct  REAL,
      impact_statement    TEXT,
      raw_response        TEXT,
      created_at          TEXT DEFAULT (datetime('now'))
    );

    -- WhatsApp conversation logs — Module 4
    CREATE TABLE IF NOT EXISTS whatsapp_logs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      phone       TEXT,
      direction   TEXT,   -- 'inbound' | 'outbound'
      message     TEXT,
      intent      TEXT,
      escalated   INTEGER DEFAULT 0,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    -- General AI prompt/response log (all modules)
    CREATE TABLE IF NOT EXISTS ai_logs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      module      TEXT,
      prompt      TEXT,
      response    TEXT,
      tokens_used INTEGER,
      duration_ms INTEGER,
      created_at  TEXT DEFAULT (datetime('now'))
    );
  `);

  seedDemoData(db);
}

function seedDemoData(db) {
  const count = db.prepare("SELECT COUNT(*) as c FROM products").get();
  if (count.c > 0) return;

  const insertProduct = db.prepare(
    "INSERT OR IGNORE INTO products (id, name, description, price) VALUES (?, ?, ?, ?)"
  );
  const insertOrder = db.prepare(
    "INSERT OR IGNORE INTO orders (id, customer, phone, items, total, status) VALUES (?, ?, ?, ?, ?, ?)"
  );

  const products = [
    ["P001", "Bamboo Toothbrush Pack (4)", "Biodegradable bamboo handle, BPA-free bristles. Plastic-free packaging.", 299],
    ["P002", "Organic Cotton Tote Bag", "GOTS certified organic cotton, hand-woven by rural artisans.", 499],
    ["P003", "Compostable Food Wrap (20 sheets)", "Plant-based PLA film, replaces cling wrap entirely.", 349],
    ["P004", "Recycled Steel Water Bottle 750ml", "Made from 80% post-consumer recycled steel. Lifetime warranty.", 799],
    ["P005", "Neem Wood Comb", "Sustainably harvested neem, antifungal, zero plastic.", 149],
    ["P006", "Beeswax Candles Set of 3", "100% pure beeswax, cotton wick, no paraffin or synthetic fragrance.", 599],
    ["P007", "Jute Shopping Bag Large", "Natural jute fibre, carries up to 15kg, replaces 500 plastic bags.", 199],
    ["P008", "Recycled Paper Notebook A5", "Made from 100% post-consumer waste paper, soy ink printing.", 249],
    ["P009", "Coconut Shell Bowls (2)", "Hand-carved, food-safe finish, zero-waste by-product.", 449],
    ["P010", "Activated Charcoal Soap Bar", "Vegan, palm-oil free, zero-waste paper packaging.", 179],
  ];

  const orders = [
    ["ORD-2024-001", "Priya Sharma", "+919876543210", JSON.stringify([{ id: "P001", qty: 2 }, { id: "P003", qty: 3 }]), 1345, "delivered"],
    ["ORD-2024-002", "Rohan Mehta", "+919123456789", JSON.stringify([{ id: "P004", qty: 1 }, { id: "P007", qty: 2 }]), 1197, "processing"],
    ["ORD-2024-003", "Anjali Singh", "+918765432109", JSON.stringify([{ id: "P002", qty: 1 }, { id: "P010", qty: 4 }]), 1215, "shipped"],
    ["ORD-2024-004", "Vikram Nair", "+917654321098", JSON.stringify([{ id: "P005", qty: 3 }, { id: "P008", qty: 2 }]), 945, "processing"],
    ["ORD-2024-005", "Meera Iyer", "+916543210987", JSON.stringify([{ id: "P006", qty: 2 }, { id: "P009", qty: 1 }]), 1647, "delivered"],
  ];

  db.transaction(() => {
    products.forEach((p) => insertProduct.run(...p));
    orders.forEach((o) => insertOrder.run(...o));
  })();
}
