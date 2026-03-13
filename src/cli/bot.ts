import { requireTelegramConfig } from "../config/index.js";
import { getDb, closeDb } from "../db/index.js";
import { createBot } from "../telegram/bot.js";

async function main(): Promise<void> {
  console.log("Minicharles Telegram Bot\n");

  const telegram = requireTelegramConfig();

  getDb();

  const bot = createBot(telegram.botToken, telegram.chatId);

  const shutdown = async () => {
    console.log("\nShutting down...");
    await bot.stop();
    closeDb();
  };

  process.on("SIGINT", () => {
    void shutdown();
  });
  process.on("SIGTERM", () => {
    void shutdown();
  });

  console.log("Bot is running (press Ctrl+C to stop)\n");
  await bot.start();
}

main().catch((error) => {
  console.error("Failed to start bot:", error);
  closeDb();
  process.exit(1);
});
