import { config as loadDotenv } from "dotenv";
import { z } from "zod";

loadDotenv();

const envSchema = z.object({
  // Required for Phase 1
  AZURE_CLIENT_ID: z.string().min(1, "AZURE_CLIENT_ID is required"),
  AZURE_TENANT_ID: z.string().min(1, "AZURE_TENANT_ID is required"),

  // Phase 4
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),

  // Database
  DATABASE_PATH: z.string().default("./data/minicharles.db"),
});

export type Env = z.infer<typeof envSchema>;

function loadConfig(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    const formatted = Object.entries(errors)
      .map(([key, msgs]) => `  ${key}: ${msgs?.join(", ")}`)
      .join("\n");
    console.error("❌ Invalid environment variables:\n" + formatted);
    console.error("\nCopy .env.example to .env and fill in the required values.");
    process.exit(1);
  }
  return result.data;
}

export const config = loadConfig();

/** Microsoft Graph API scopes needed by Minicharles */
export const GRAPH_SCOPES = [
  "Mail.Read",
  "Mail.ReadWrite",
  "Mail.Send",
  "User.Read",
] as const;

export interface TelegramConfig {
  readonly botToken: string;
  readonly chatId: string;
}

/** Validate and return Telegram config, exit if missing */
export function requireTelegramConfig(): TelegramConfig {
  if (!config.TELEGRAM_BOT_TOKEN || !config.TELEGRAM_CHAT_ID) {
    console.error(
      "TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are required.\n" +
        "Set them in your .env file.",
    );
    process.exit(1);
  }
  return {
    botToken: config.TELEGRAM_BOT_TOKEN,
    chatId: config.TELEGRAM_CHAT_ID,
  };
}

