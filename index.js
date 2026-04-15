import "dotenv/config";
import bot from "./bot/telegram.js";
import Database from "better-sqlite3";   // npm install better-sqlite3

// Initialize SQLite DB
const db = new Database("sentinel.db", { verbose: console.log });

console.log("🚀 Sentinel Telegram Bot is running...");

// Create tables if they don't exist
db.exec(`

  CREATE TABLE IF NOT EXISTS users (
    chat_id INTEGER PRIMARY KEY,
    wallet_address TEXT,
    protection_mode BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS policies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    -- Removed FOREIGN KEY for simplicity
  );

  CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER,
    action TEXT,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);


global.db = db;  

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("Shutting down Sentinel...");
  db.close();
  process.exit(0);
});