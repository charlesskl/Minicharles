import { execFile } from "node:child_process";
import { resolve } from "node:path";
import type Database from "better-sqlite3";
import { OutlookClient } from "../graph/client.js";
import { getDb } from "../db/index.js";
import type { EmailMessage, PipelineRunResult } from "../types/index.js";
import { buildClassificationPrompt } from "./prompt.js";

const MCP_CONFIG_PATH = resolve(
  import.meta.dirname,
  "../../claude-mcp-config.json",
);

/**
 * Classification pipeline runner.
 * Fetches inbox emails, builds a prompt, invokes `claude -p`,
 * and logs results to SQLite.
 */
export class ClassificationRunner {
  private readonly client: OutlookClient;
  private readonly db: Database.Database;

  constructor() {
    this.client = new OutlookClient();
    this.db = getDb();
  }

  async run(): Promise<PipelineRunResult> {
    const startTime = Date.now();
    const runId = this.startRun();

    try {
      // Fetch folder list and inbox emails
      console.log("📁 Loading folders...");
      const folders = await this.client.listFolders();

      console.log("📬 Fetching inbox emails...");
      const messages = await this.client.getMessages("inbox", 50);
      const unprocessed = this.filterUnprocessed(messages);

      if (unprocessed.length === 0) {
        console.log("✅ No new emails to classify.");
        this.completeRun(runId, 0, "");
        return {
          runId,
          emailsProcessed: 0,
          claudeOutput: "",
          durationMs: Date.now() - startTime,
        };
      }

      console.log(`🔍 Classifying ${unprocessed.length} email(s) via Claude...\n`);

      // Build prompt and invoke claude
      const prompt = buildClassificationPrompt(unprocessed, folders);
      const output = await this.invokeClaude(prompt);

      console.log("\n📋 Claude output:\n");
      console.log(output);

      // Log each email
      for (const email of unprocessed) {
        this.logEmail(email);
      }

      this.completeRun(runId, unprocessed.length, output);

      return {
        runId,
        emailsProcessed: unprocessed.length,
        claudeOutput: output,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.failRun(runId, msg);
      throw error;
    }
  }

  /** Invoke `claude -p` with MCP config */
  private invokeClaude(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(
        "claude",
        [
          "-p",
          prompt,
          "--mcp-config",
          MCP_CONFIG_PATH,
        ],
        { maxBuffer: 1024 * 1024, timeout: 300_000 },
        (error, stdout, stderr) => {
          if (error) {
            reject(
              new Error(
                `claude CLI failed: ${error.message}${stderr ? `\nstderr: ${stderr}` : ""}`,
              ),
            );
            return;
          }
          resolve(stdout.trim());
        },
      );
    });
  }

  /** Filter out emails already processed in a previous run */
  private filterUnprocessed(
    messages: readonly EmailMessage[],
  ): readonly EmailMessage[] {
    const stmt = this.db.prepare(
      "SELECT messageId FROM email_log WHERE messageId = ?",
    );
    return messages.filter((m) => !stmt.get(m.id));
  }

  /** Log an email to the database */
  private logEmail(email: EmailMessage): void {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO email_log (messageId, subject, "from", receivedAt, classifiedAt)
         VALUES (?, ?, ?, ?, datetime('now'))`,
      )
      .run(
        email.id,
        email.subject,
        email.from.address,
        email.receivedDateTime,
      );
  }

  private startRun(): number {
    const info = this.db
      .prepare("INSERT INTO run_log (status) VALUES ('running')")
      .run();
    return Number(info.lastInsertRowid);
  }

  private completeRun(
    runId: number,
    emailsProcessed: number,
    output: string,
  ): void {
    this.db
      .prepare(
        "UPDATE run_log SET completedAt = datetime('now'), emailsProcessed = ?, status = 'completed', error = ? WHERE id = ?",
      )
      .run(emailsProcessed, output || null, runId);
  }

  private failRun(runId: number, error: string): void {
    this.db
      .prepare(
        "UPDATE run_log SET completedAt = datetime('now'), status = 'failed', error = ? WHERE id = ?",
      )
      .run(error, runId);
  }
}
