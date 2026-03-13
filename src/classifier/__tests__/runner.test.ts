import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetMessages, mockListFolders, mockDbRun, mockDbGet, mockPrepare, mockExecFile } = vi.hoisted(() => {
  const mockDbRun = vi.fn().mockReturnValue({ lastInsertRowid: 1 });
  const mockDbGet = vi.fn().mockReturnValue(undefined);
  const mockPrepare = vi.fn().mockReturnValue({
    run: mockDbRun,
    get: mockDbGet,
  });

  return {
    mockGetMessages: vi.fn(),
    mockListFolders: vi.fn(),
    mockDbRun,
    mockDbGet,
    mockPrepare,
    mockExecFile: vi.fn(),
  };
});

vi.mock("../../config/index.js", () => ({
  config: {
    AZURE_CLIENT_ID: "test-client-id",
    AZURE_TENANT_ID: "test-tenant-id",
    DATABASE_PATH: ":memory:",
  },
  GRAPH_SCOPES: ["Mail.Read", "Mail.ReadWrite"],
}));

vi.mock("../../auth/index.js", () => ({
  getCredential: vi.fn().mockReturnValue({}),
}));

vi.mock("../../graph/client.js", () => ({
  OutlookClient: vi.fn().mockImplementation(() => ({
    listFolders: mockListFolders,
    getMessages: mockGetMessages,
  })),
}));

vi.mock("../../db/index.js", () => ({
  getDb: vi.fn().mockReturnValue({
    prepare: mockPrepare,
    pragma: vi.fn(),
    exec: vi.fn(),
    close: vi.fn(),
  }),
  closeDb: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  execFile: mockExecFile,
}));

import { ClassificationRunner } from "../runner.js";

describe("ClassificationRunner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbGet.mockReturnValue(undefined);
    mockDbRun.mockReturnValue({ lastInsertRowid: 1 });
    mockListFolders.mockResolvedValue([
      {
        id: "inbox-id",
        displayName: "Inbox",
        parentFolderId: null,
        childFolderCount: 0,
        totalItemCount: 5,
        unreadItemCount: 2,
      },
      {
        id: "finance-id",
        displayName: "Finance",
        parentFolderId: null,
        childFolderCount: 0,
        totalItemCount: 10,
        unreadItemCount: 0,
      },
    ]);
    mockGetMessages.mockResolvedValue([
      {
        id: "msg-1",
        subject: "Bank statement",
        from: { name: "Bank", address: "bank@example.com" },
        toRecipients: [{ name: "User", address: "user@example.com" }],
        receivedDateTime: "2026-03-13T10:00:00Z",
        bodyPreview: "Your statement is ready",
        body: { contentType: "text", content: "Your statement is ready" },
        isRead: false,
        parentFolderId: "inbox-id",
        hasAttachments: false,
      },
    ]);
  });

  it("should run the pipeline and invoke claude CLI", async () => {
    mockExecFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
        cb(null, '{"results": [], "totalProcessed": 1, "totalMoved": 1}', "");
      },
    );

    const runner = new ClassificationRunner();
    const result = await runner.run();

    expect(result.emailsProcessed).toBe(1);
    expect(result.claudeOutput).toContain("totalProcessed");

    expect(mockExecFile).toHaveBeenCalledOnce();
    const [cmd, args] = mockExecFile.mock.calls[0];
    expect(cmd).toBe("claude");
    expect(args).toContain("-p");
    expect(args).toContain("--mcp-config");
  });

  it("should skip already processed emails", async () => {
    mockDbGet.mockReturnValue({ messageId: "msg-1" });

    const runner = new ClassificationRunner();
    const result = await runner.run();

    expect(result.emailsProcessed).toBe(0);
    expect(mockExecFile).not.toHaveBeenCalled();
  });

  it("should handle claude CLI errors", async () => {
    mockExecFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
        cb(new Error("claude not found"), "", "command not found");
      },
    );

    const runner = new ClassificationRunner();
    await expect(runner.run()).rejects.toThrow("claude CLI failed");
  });

  it("should log emails to database", async () => {
    mockExecFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
        cb(null, "done", "");
      },
    );

    const runner = new ClassificationRunner();
    await runner.run();

    expect(mockPrepare).toHaveBeenCalled();
    expect(mockDbRun).toHaveBeenCalled();
  });

  it("should handle empty inbox", async () => {
    mockGetMessages.mockResolvedValue([]);

    const runner = new ClassificationRunner();
    const result = await runner.run();

    expect(result.emailsProcessed).toBe(0);
    expect(result.claudeOutput).toBe("");
    expect(mockExecFile).not.toHaveBeenCalled();
  });
});
