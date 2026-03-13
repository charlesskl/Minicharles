import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { config } from "../config/index.js";

function ensureDataDir(dbPath: string): void {
  const dir = dirname(dbPath);
  mkdirSync(dir, { recursive: true });
}

function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_log (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      messageId     TEXT    NOT NULL UNIQUE,
      subject       TEXT    NOT NULL,
      "from"        TEXT    NOT NULL,
      receivedAt    TEXT    NOT NULL,
      folderId      TEXT,
      folderName    TEXT,
      classifiedAt  TEXT,
      summary       TEXT
    );

    CREATE TABLE IF NOT EXISTS app_config (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS run_log (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      startedAt       TEXT    NOT NULL DEFAULT (datetime('now')),
      completedAt     TEXT,
      emailsProcessed INTEGER NOT NULL DEFAULT 0,
      status          TEXT    NOT NULL DEFAULT 'running'
                      CHECK (status IN ('running', 'completed', 'failed')),
      error           TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_email_log_messageId ON email_log(messageId);
    CREATE INDEX IF NOT EXISTS idx_email_log_receivedAt ON email_log(receivedAt);
    CREATE INDEX IF NOT EXISTS idx_run_log_startedAt ON run_log(startedAt);
  `);
}

let _db: Database.Database | null = null;

/** Get or create the SQLite database connection */
export function getDb(): Database.Database {
  if (_db) return _db;

  ensureDataDir(config.DATABASE_PATH);
  _db = new Database(config.DATABASE_PATH);

  // Enable WAL mode for better concurrent read performance
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");

  runMigrations(_db);
  return _db;
}

/** Close the database connection */
export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}
