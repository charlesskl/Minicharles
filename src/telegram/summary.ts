import Anthropic from "@anthropic-ai/sdk";
import { getDb } from "../db/index.js";
import type { EmailLogRow, RunLogRow } from "../types/index.js";
import { escapeHtml } from "./notification.js";

/**
 * Generates daily email summaries by querying the local SQLite database
 * and using Claude to produce a well-formatted Telegram message.
 */
export class SummaryGenerator {
  private readonly anthropic: Anthropic;

  constructor(apiKey: string) {
    this.anthropic = new Anthropic({ apiKey });
  }

  /** Generate today's email summary formatted for Telegram (HTML) */
  async generateDailySummary(): Promise<string> {
    const emails = getTodayEmails();
    const lastRun = getLastRun();

    if (emails.length === 0) {
      return formatEmptySummary(lastRun);
    }

    return this.generateWithClaude(emails, lastRun);
  }

  private async generateWithClaude(
    emails: readonly EmailLogRow[],
    lastRun: RunLogRow | undefined,
  ): Promise<string> {
    const today = formatToday();

    // Escape HTML-sensitive chars in email data so Claude doesn't produce broken tags
    const emailData = emails.map((e) => ({
      from: escapeHtml(e.from),
      subject: escapeHtml(e.subject),
      folder: escapeHtml(e.folderName ?? "Uncategorized"),
      summary: escapeHtml(e.summary ?? e.subject),
      receivedAt: e.receivedAt,
    }));

    const processedTime = lastRun
      ? new Date(lastRun.startedAt).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        })
      : null;

    const prompt = `Generate a Telegram daily email summary for ${today}.

Here are today's ${emails.length} emails:
${JSON.stringify(emailData, null, 2)}

Format rules (Telegram HTML):
- Use <b>bold</b> for key numbers (amounts, percentages, quantities) and key dates (deadlines, meetings, events)
- Group emails by folder/category with a folder emoji header
- For each email: sender in bold, subject, then 1-2 line summary
- End with "Action Items" section if any emails require action
- End with a stats footer line

Use this structure exactly:
<b>Daily Email Summary — ${today}</b>

<folder emoji> <b>FolderName</b> (N emails)
• <b>Sender</b> — Subject
  Summary with <b>key numbers</b> and <b>key dates</b> highlighted.

<b>Action Items:</b>
1. Action item description

${emails.length} emails sorted${processedTime ? ` | Processed at ${processedTime}` : ""}

IMPORTANT: Return ONLY the formatted summary. Use only Telegram HTML tags: <b>, <i>, <code>. No Markdown.`;

    const response = await this.anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    let text = "";
    for (const block of response.content) {
      if (block.type === "text") {
        text += block.text;
      }
    }

    return text;
  }
}

/** Query today's emails from the database */
function getTodayEmails(): readonly EmailLogRow[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM email_log
       WHERE date(receivedAt, 'localtime') = date('now', 'localtime')
       ORDER BY receivedAt ASC`,
    )
    .all() as EmailLogRow[];
}

/** Get the most recent run log entry */
function getLastRun(): RunLogRow | undefined {
  const db = getDb();
  return db
    .prepare("SELECT * FROM run_log ORDER BY startedAt DESC LIMIT 1")
    .get() as RunLogRow | undefined;
}

/** Format an empty-day summary */
function formatEmptySummary(lastRun: RunLogRow | undefined): string {
  const today = formatToday();
  let text = `<b>Daily Email Summary — ${escapeHtml(today)}</b>\n\n`;
  text += "No emails processed today.\n";

  if (lastRun) {
    text += `\nLast run: ${escapeHtml(lastRun.startedAt)} (${escapeHtml(lastRun.status)})`;
  }

  return text;
}

function formatToday(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
