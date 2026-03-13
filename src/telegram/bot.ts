import { Bot } from "grammy";
import { getDb } from "../db/index.js";
import { OutlookClient } from "../graph/client.js";
import { SummaryGenerator } from "./summary.js";
import { splitMessage, escapeHtml } from "./notification.js";
import type { RunLogRow } from "../types/index.js";

/**
 * Create and configure the Minicharles Telegram bot.
 * Only responds to the authorized chat ID for security.
 */
export function createBot(
  botToken: string,
  chatId: string,
  anthropicApiKey: string,
): Bot {
  const bot = new Bot(botToken);
  const authorizedChatId = Number(chatId);

  // Global error handler
  bot.catch((err) => {
    console.error("Bot error:", err.error ?? err);
  });

  // Security middleware: silently ignore unauthorized chats
  bot.use(async (ctx, next) => {
    if (ctx.chat?.id !== authorizedChatId) {
      return;
    }
    await next();
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(
      "<b>Minicharles Bot</b>\n\n" +
        "/status — Last run info\n" +
        "/summary — Generate today's summary\n" +
        "/folders — List Outlook folder stats\n" +
        "/help — Show this help message",
      { parse_mode: "HTML" },
    );
  });

  bot.command("status", async (ctx) => {
    try {
      const db = getDb();
      const lastRun = db
        .prepare("SELECT * FROM run_log ORDER BY startedAt DESC LIMIT 1")
        .get() as RunLogRow | undefined;

      if (!lastRun) {
        await ctx.reply("No runs recorded yet.");
        return;
      }

      const statusEmoji =
        lastRun.status === "completed"
          ? "✅"
          : lastRun.status === "failed"
            ? "❌"
            : "⏳";

      const lines = [
        `${statusEmoji} <b>Last Run</b>\n`,
        `Status: ${escapeHtml(lastRun.status)}`,
        `Started: ${escapeHtml(lastRun.startedAt)}`,
      ];

      if (lastRun.completedAt) {
        lines.push(`Completed: ${escapeHtml(lastRun.completedAt)}`);
      }
      lines.push(`Emails processed: ${lastRun.emailsProcessed}`);

      if (lastRun.error) {
        lines.push(`Error: <code>${escapeHtml(lastRun.error)}</code>`);
      }

      await ctx.reply(lines.join("\n"), { parse_mode: "HTML" });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await ctx.reply(
        `Failed to fetch status: ${escapeHtml(msg)}`,
        { parse_mode: "HTML" },
      );
    }
  });

  bot.command("summary", async (ctx) => {
    await ctx.reply("Generating summary...");

    try {
      const generator = new SummaryGenerator(anthropicApiKey);
      const summary = await generator.generateDailySummary();

      const chunks = splitMessage(summary, 4096);
      for (const chunk of chunks) {
        await ctx.reply(chunk, { parse_mode: "HTML" });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await ctx.reply(
        `Failed to generate summary: ${escapeHtml(msg)}`,
        { parse_mode: "HTML" },
      );
    }
  });

  bot.command("folders", async (ctx) => {
    try {
      const client = new OutlookClient();
      const folders = await client.listFolders();

      let text = "<b>Outlook Folders</b>\n\n";
      for (const folder of folders) {
        const unread =
          folder.unreadItemCount > 0
            ? ` (<b>${folder.unreadItemCount}</b> unread)`
            : "";
        text += `• ${escapeHtml(folder.displayName)} — ${folder.totalItemCount} items${unread}\n`;
      }

      const chunks = splitMessage(text, 4096);
      for (const chunk of chunks) {
        await ctx.reply(chunk, { parse_mode: "HTML" });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await ctx.reply(
        `Failed to fetch folders: ${escapeHtml(msg)}\n\n` +
          "Make sure you've run <code>npm run auth</code> first.",
        { parse_mode: "HTML" },
      );
    }
  });

  return bot;
}
