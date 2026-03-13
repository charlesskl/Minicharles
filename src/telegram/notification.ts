import { Api } from "grammy";

const TELEGRAM_MAX_LENGTH = 4096;

/**
 * Sends messages to a Telegram chat.
 * Handles message length limits by splitting long messages at natural boundaries.
 */
export class NotificationService {
  private readonly api: Api;
  private readonly chatId: string;

  constructor(botToken: string, chatId: string) {
    this.api = new Api(botToken);
    this.chatId = chatId;
  }

  /** Send the daily email summary (HTML formatted) */
  async sendDailySummary(summary: string): Promise<void> {
    await this.sendLongMessage(summary);
  }

  /** Send an alert message for errors or urgent notifications */
  async sendAlert(message: string): Promise<void> {
    await this.sendLongMessage(message);
  }

  private async sendLongMessage(text: string): Promise<void> {
    const chunks = splitMessage(text, TELEGRAM_MAX_LENGTH);
    for (const chunk of chunks) {
      await this.api.sendMessage(this.chatId, chunk, { parse_mode: "HTML" });
    }
  }
}

/**
 * Split a message into chunks respecting Telegram's max length.
 * Avoids splitting inside HTML tags to prevent parse errors.
 */
export function splitMessage(
  text: string,
  maxLength: number,
): readonly string[] {
  if (text.length <= maxLength) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // Prefer splitting at paragraph boundary
    let splitIndex = remaining.lastIndexOf("\n\n", maxLength);
    if (splitIndex === -1 || splitIndex < maxLength * 0.3) {
      splitIndex = remaining.lastIndexOf("\n", maxLength);
    }
    if (splitIndex === -1 || splitIndex < maxLength * 0.3) {
      splitIndex = remaining.lastIndexOf(" ", maxLength);
    }
    if (splitIndex === -1 || splitIndex < maxLength * 0.3) {
      splitIndex = maxLength;
    }

    // Avoid splitting inside an HTML tag (between < and >)
    splitIndex = adjustForHtmlTags(remaining, splitIndex);

    chunks.push(remaining.slice(0, splitIndex));
    remaining = remaining.slice(splitIndex);
    // Remove at most one leading newline to preserve paragraph structure
    if (remaining.startsWith("\n")) {
      remaining = remaining.slice(1);
    }
  }

  return chunks;
}

/**
 * If splitIndex falls inside an HTML tag, move it before the tag opening.
 * Prevents sending unclosed `<b` or similar fragments.
 */
function adjustForHtmlTags(text: string, splitIndex: number): number {
  const lastOpen = text.lastIndexOf("<", splitIndex);
  const lastClose = text.lastIndexOf(">", splitIndex);

  // If the last '<' is after the last '>', we're inside a tag — move before it
  if (lastOpen > lastClose && lastOpen > 0) {
    return lastOpen;
  }

  return splitIndex;
}

/** Escape HTML special characters for Telegram HTML parse mode */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
