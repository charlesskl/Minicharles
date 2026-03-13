import { describe, it, expect } from "vitest";
import { buildClassificationPrompt } from "../prompt.js";
import type { EmailMessage, MailFolder } from "../../types/index.js";

const MOCK_FOLDERS: readonly MailFolder[] = [
  {
    id: "inbox-id",
    displayName: "Inbox",
    parentFolderId: null,
    childFolderCount: 0,
    totalItemCount: 10,
    unreadItemCount: 3,
  },
  {
    id: "finance-id",
    displayName: "Finance",
    parentFolderId: null,
    childFolderCount: 0,
    totalItemCount: 50,
    unreadItemCount: 0,
  },
  {
    id: "work-id",
    displayName: "Work",
    parentFolderId: null,
    childFolderCount: 0,
    totalItemCount: 20,
    unreadItemCount: 1,
  },
  {
    id: "drafts-id",
    displayName: "Drafts",
    parentFolderId: null,
    childFolderCount: 0,
    totalItemCount: 2,
    unreadItemCount: 0,
  },
  {
    id: "sent-id",
    displayName: "Sent Items",
    parentFolderId: null,
    childFolderCount: 0,
    totalItemCount: 100,
    unreadItemCount: 0,
  },
  {
    id: "junk-id",
    displayName: "Junk Email",
    parentFolderId: null,
    childFolderCount: 0,
    totalItemCount: 5,
    unreadItemCount: 0,
  },
];

const MOCK_EMAIL: EmailMessage = {
  id: "msg-1",
  subject: "Your monthly bank statement",
  from: { name: "Bank of Example", address: "noreply@bank.example.com" },
  toRecipients: [{ name: "User", address: "user@example.com" }],
  receivedDateTime: "2026-03-13T10:00:00Z",
  bodyPreview: "Your March 2026 statement is ready to view.",
  body: {
    contentType: "text",
    content: "Your March 2026 statement is ready to view.",
  },
  isRead: false,
  parentFolderId: "inbox-id",
  hasAttachments: true,
};

describe("buildClassificationPrompt", () => {
  it("should include all non-system folders", () => {
    const prompt = buildClassificationPrompt([MOCK_EMAIL], MOCK_FOLDERS);

    expect(prompt).toContain('"Inbox"');
    expect(prompt).toContain('"Finance"');
    expect(prompt).toContain('"Work"');
    expect(prompt).not.toContain('"Drafts"');
    expect(prompt).not.toContain('"Sent Items"');
    expect(prompt).not.toContain('"Junk Email"');
  });

  it("should include folder IDs", () => {
    const prompt = buildClassificationPrompt([MOCK_EMAIL], MOCK_FOLDERS);

    expect(prompt).toContain("id: inbox-id");
    expect(prompt).toContain("id: finance-id");
    expect(prompt).toContain("id: work-id");
  });

  it("should include email details", () => {
    const prompt = buildClassificationPrompt([MOCK_EMAIL], MOCK_FOLDERS);

    expect(prompt).toContain("msg-1");
    expect(prompt).toContain("Your monthly bank statement");
    expect(prompt).toContain("Bank of Example");
    expect(prompt).toContain("noreply@bank.example.com");
    expect(prompt).toContain("Your March 2026 statement is ready to view.");
  });

  it("should include MCP tool instructions", () => {
    const prompt = buildClassificationPrompt([MOCK_EMAIL], MOCK_FOLDERS);

    expect(prompt).toContain("outlook_move_message");
    expect(prompt).toContain("messageId");
    expect(prompt).toContain("destinationFolderId");
  });

  it("should request JSON summary output", () => {
    const prompt = buildClassificationPrompt([MOCK_EMAIL], MOCK_FOLDERS);

    expect(prompt).toContain('"results"');
    expect(prompt).toContain('"totalProcessed"');
    expect(prompt).toContain('"totalMoved"');
  });

  it("should handle multiple emails", () => {
    const email2: EmailMessage = {
      ...MOCK_EMAIL,
      id: "msg-2",
      subject: "Meeting tomorrow",
      from: { name: "Boss", address: "boss@work.com" },
    };

    const prompt = buildClassificationPrompt([MOCK_EMAIL, email2], MOCK_FOLDERS);

    expect(prompt).toContain("Email 1");
    expect(prompt).toContain("Email 2");
    expect(prompt).toContain("msg-1");
    expect(prompt).toContain("msg-2");
  });

  it("should truncate long email bodies", () => {
    const longEmail: EmailMessage = {
      ...MOCK_EMAIL,
      bodyPreview: "x".repeat(3000),
    };

    const prompt = buildClassificationPrompt([longEmail], MOCK_FOLDERS);

    expect(prompt).toContain("[truncated]");
    expect(prompt.length).toBeLessThan(5000);
  });

  it("should strip HTML tags from body when no preview available", () => {
    const htmlEmail: EmailMessage = {
      ...MOCK_EMAIL,
      bodyPreview: "",
      body: {
        contentType: "html",
        content: "<p>Hello <b>World</b></p>",
      },
    };

    const prompt = buildClassificationPrompt([htmlEmail], MOCK_FOLDERS);

    expect(prompt).not.toContain("<p>");
    expect(prompt).not.toContain("<b>");
    expect(prompt).toContain("Hello");
    expect(prompt).toContain("World");
  });

  it("should indicate attachment presence", () => {
    const prompt = buildClassificationPrompt([MOCK_EMAIL], MOCK_FOLDERS);
    expect(prompt).toContain("Has Attachments**: true");
  });
});
