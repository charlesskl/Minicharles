import { describe, it, expect } from "vitest";
import { processAttachment } from "../attachments.js";
import type { Attachment } from "../../types/index.js";

function makeAttachment(overrides: Partial<Attachment> = {}): Attachment {
  return {
    id: "att-1",
    name: "test.txt",
    contentType: "text/plain",
    size: 100,
    isInline: false,
    ...overrides,
  };
}

describe("processAttachment", () => {
  it("returns metadata when no contentBytes present", async () => {
    const att = makeAttachment({ contentBytes: undefined });
    const result = JSON.parse(await processAttachment(att));
    expect(result.note).toContain("No content bytes");
    expect(result.name).toBe("test.txt");
  });

  it("returns text content for text/plain files", async () => {
    const content = "Hello, world!";
    const att = makeAttachment({
      contentType: "text/plain",
      contentBytes: Buffer.from(content).toString("base64"),
      size: content.length,
    });
    const result = JSON.parse(await processAttachment(att));
    expect(result.content).toBe("Hello, world!");
    expect(result.name).toBe("test.txt");
  });

  it("returns text content for CSV files", async () => {
    const csv = "name,age\nAlice,30\nBob,25";
    const att = makeAttachment({
      name: "data.csv",
      contentType: "text/csv",
      contentBytes: Buffer.from(csv).toString("base64"),
      size: csv.length,
    });
    const result = JSON.parse(await processAttachment(att));
    expect(result.content).toContain("Alice");
  });

  it("returns text content for JSON files", async () => {
    const json = '{"key": "value"}';
    const att = makeAttachment({
      name: "data.json",
      contentType: "application/json",
      contentBytes: Buffer.from(json).toString("base64"),
      size: json.length,
    });
    const result = JSON.parse(await processAttachment(att));
    expect(result.content).toBe(json);
  });

  it("returns text content for HTML files", async () => {
    const html = "<h1>Hello</h1>";
    const att = makeAttachment({
      name: "page.html",
      contentType: "text/html",
      contentBytes: Buffer.from(html).toString("base64"),
      size: html.length,
    });
    const result = JSON.parse(await processAttachment(att));
    expect(result.content).toContain("<h1>Hello</h1>");
  });

  it("returns metadata only for image attachments", async () => {
    const att = makeAttachment({
      name: "photo.png",
      contentType: "image/png",
      contentBytes: Buffer.from("fakeimagebytes").toString("base64"),
      size: 1024,
    });
    const result = JSON.parse(await processAttachment(att));
    expect(result.note).toContain("Image attachment");
    expect(result.name).toBe("photo.png");
    expect(result.contentType).toBe("image/png");
    expect(result).not.toHaveProperty("content");
  });

  it("returns metadata only for unknown binary types", async () => {
    const att = makeAttachment({
      name: "archive.zip",
      contentType: "application/zip",
      contentBytes: Buffer.from("fakezip").toString("base64"),
      size: 2048,
    });
    const result = JSON.parse(await processAttachment(att));
    expect(result.note).toContain("Binary attachment");
    expect(result.name).toBe("archive.zip");
  });

  it("handles content type with charset parameter", async () => {
    const content = "UTF-8 text";
    const att = makeAttachment({
      contentType: "text/plain; charset=utf-8",
      contentBytes: Buffer.from(content).toString("base64"),
      size: content.length,
    });
    const result = JSON.parse(await processAttachment(att));
    expect(result.content).toBe("UTF-8 text");
  });

  it("handles XML content type", async () => {
    const xml = '<?xml version="1.0"?><root/>';
    const att = makeAttachment({
      name: "data.xml",
      contentType: "application/xml",
      contentBytes: Buffer.from(xml).toString("base64"),
      size: xml.length,
    });
    const result = JSON.parse(await processAttachment(att));
    expect(result.content).toContain("<root/>");
  });
});
