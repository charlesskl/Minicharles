import { getDb, closeDb } from "./db/index.js";

async function main(): Promise<void> {
  console.log("🤖 Minicharles — Outlook Email Sorter & Summarizer\n");
  console.log("Available commands:");
  console.log("  npm run auth             — Authenticate with Microsoft 365");
  console.log("  npm run test-connection  — Verify auth and list folders");
  console.log("  npm run bot              — Start Telegram bot (long-polling)");
  console.log("  npm run send-summary     — Generate and send today's summary");
  console.log("");

  // Initialize database on first run
  getDb();
  console.log("📦 Database ready.");
  closeDb();
}

main();
