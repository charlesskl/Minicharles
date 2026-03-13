import { requireTelegramConfig } from "../config/index.js";
import { getDb, closeDb } from "../db/index.js";
import { SummaryGenerator } from "../telegram/summary.js";
import { NotificationService } from "../telegram/notification.js";

async function main(): Promise<void> {
  console.log("Minicharles — Daily Summary\n");

  const telegram = requireTelegramConfig();

  getDb();

  console.log("Generating summary...");
  const generator = new SummaryGenerator();
  const summary = await generator.generateDailySummary();

  if (!summary) {
    console.error("Generated summary is empty, skipping send.");
    closeDb();
    process.exit(1);
  }

  console.log("Generated summary:\n");
  console.log(summary);
  console.log("\nSending to Telegram...");

  const notifier = new NotificationService(telegram.botToken, telegram.chatId);
  await notifier.sendDailySummary(summary);

  console.log("Summary sent successfully!");
  closeDb();
}

main().catch((error) => {
  console.error("Failed:", error);
  closeDb();
  process.exit(1);
});
